# Videos Module — Design

## Overview

API for game clip/session video upload, storage, retrieval, and deletion.
Target use case: Outplayed desktop client uploading recordings that range from short clips to full multi-hour sessions.

The desktop app handles all capture and transcoding (FFmpeg) locally before uploading. The backend receives a final, ready-to-serve file — no server-side transcoding.

Backend is **not** in the upload data path. Videos go directly from client to object storage.

---

## Upload Strategy: Dual-path pre-signed upload

Rejected: chunked upload *through* the backend — NestJS becomes a bandwidth bottleneck for large files.

S3 multipart upload has a **5 MB minimum part size** constraint. A 5-second 480p clip is typically 5–15 MB — it could fall below this threshold entirely. Therefore the API uses two paths based on file size, decided by the client before calling initiate:

### Path A — Single PUT (files < 50 MB)

1. Client calls `POST /videos/upload/initiate` with `{ fileSize }` → backend creates Video record (status: `pending`), returns `{ videoId, uploadType: "single", url: "<pre-signed PUT URL>" }`
2. Client PUTs file **directly to storage**
3. Client calls `POST /videos/upload/:videoId/complete` → backend verifies object exists, updates status to `ready`
4. On failure: client calls `DELETE /videos/upload/:videoId` → backend deletes object if present, deletes Video record

### Path B — Multipart PUT (files ≥ 50 MB)

1. Client calls `POST /videos/upload/initiate` with `{ fileSize }` → backend calls `CreateMultipartUpload`, returns `{ videoId, uploadType: "multipart", uploadId, partSize }`
2. Client calls `POST /videos/upload/:uploadId/parts` with `{ partNumbers: number[] }` → backend returns pre-signed PUT URLs per part (valid ~1h)
3. Client uploads parts **directly to storage** — backend is not involved
4. Client calls `POST /videos/upload/:uploadId/complete` with `{ parts: [{ partNumber, etag }] }` → backend calls `CompleteMultipartUpload`, updates Video status to `ready`
5. On failure: client calls `DELETE /videos/upload/:uploadId` → backend calls `AbortMultipartUpload`, deletes Video record

**Threshold:** 50 MB (configurable via `STORAGE_MULTIPART_THRESHOLD_MB`, default 50).
**Part size:** 10 MB default (S3 minimum: 5 MB). Backend enforces minimum on part URL requests.
**Max parts:** 10,000 (S3 limit → max ~100 GB per video at 10 MB/part).

Works identically on MinIO and AWS S3.

---

## API Endpoints

### Upload lifecycle
| Method | Path | Description |
|--------|------|-------------|
| POST | `/videos/upload/initiate` | Initiate upload (returns single or multipart path based on `fileSize`) |
| POST | `/videos/upload/:uploadId/parts` | (Multipart only) Get pre-signed URLs for part numbers |
| POST | `/videos/upload/:videoId/complete` | Finalize upload (both paths) |
| DELETE | `/videos/upload/:videoId` | Abort/cancel in-progress upload (both paths) |

### Video management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/videos` | List authenticated user's videos (paginated — tech debt, not yet implemented) |
| GET | `/videos/:id` | Get video metadata + pre-signed download URL |
| PATCH | `/videos/:id` | Update title, visibility |
| DELETE | `/videos/:id` | Delete video (storage + record) |

### (Future) Sharing
To be designed — see Open Questions.

---

## Data Model

```
Video {
  id            String        @id (uuid)
  identityId    String        @relation → Identity
  title         String?
  filename      String                    // original filename from client
  storageKey    String                    // full object key in bucket
  uploadId      String?                   // multipart uploadId (null after complete/abort)
  status        VideoStatus               // pending | ready | failed
  visibility    VideoVisibility           // private | unlisted | public (default: private)
  sizeBytes     BigInt?                   // populated on complete
  durationSecs  Int?                      // provided by client on complete
  width         Int?                      // provided by client on complete
  height        Int?                      // provided by client on complete
  mimeType      String
  createdAt     DateTime
  updatedAt     DateTime
}

enum VideoStatus     { pending, ready, failed }
enum VideoVisibility { private, unlisted, public }
```

### Storage key structure

Keys follow a namespaced pattern to support future asset types per video (thumbnails, etc.):

```
videos/{identityId}/{videoId}/original.{ext}
```

Future thumbnail uploads would land at:
```
videos/{identityId}/{videoId}/thumbnail.jpg
```

---

## Storage Abstraction

```typescript
interface VideoStorageService {
  // Single-path (small files)
  getSingleUploadUrl(key: string, mimeType: string): Promise<{ url: string }>

  // Multipart-path (large files)
  initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }>
  getPartUploadUrls(key: string, uploadId: string, partNumbers: number[]): Promise<{ partNumber: number; url: string }[]>
  completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>
  abortMultipartUpload(key: string, uploadId: string): Promise<void>

  // Shared
  objectExists(key: string): Promise<boolean>
  getDownloadUrl(key: string, expiresInSecs?: number): Promise<string>
  deleteObject(key: string): Promise<void>
}
```

Single implementation (`S3VideoStorageService`) using `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
Pointed at MinIO locally, real S3 in prod — no code change, only env vars differ.

---

## Storage Lifecycle (not yet implemented)

Game recordings are typically accessed shortly after capture and rarely revisited. S3 lifecycle rules should be configured on the bucket (outside this codebase) to move objects to cheaper storage tiers over time:

- **0–30 days**: S3 Standard
- **30–90 days**: S3 Infrequent Access
- **90+ days**: S3 Glacier Instant Retrieval (or delete, depending on retention policy)

This is a bucket-level concern and requires no application code changes.

---

## Environment Variables

```env
STORAGE_ENDPOINT=http://localhost:9000   # omit in prod (uses default S3 endpoint)
STORAGE_BUCKET=game-auth-videos
STORAGE_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
STORAGE_MULTIPART_THRESHOLD_MB=50        # files below this use single PUT, default 50
STORAGE_PART_SIZE_MB=10                  # multipart part size, default 10 (min 5)
STORAGE_URL_EXPIRY_SECS=3600             # pre-signed URL TTL, default 3600
# STORAGE_CDN_DOMAIN=https://cdn.example.com  # optional; if set, download URLs use CDN instead of direct S3
```

---

## MinIO (local dev)

Add to `docker-compose.yml`:

```yaml
minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # Web console (http://localhost:9001)
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 5s
    retries: 5
```

Bucket must exist before uploads. Options: create via MinIO console, or a one-shot init container.

---

## Decisions

1. **Sharing**: client-only concern for now. No share token model. `visibility` field controls access; backend enforces it on download URL generation.
2. **Bucket init**: init container in docker-compose — `docker compose up` must be fully self-contained with no manual steps.
3. **Video metadata**: client provides `durationSecs`, `width`, `height` on `complete`. Backend stores as-is, no server-side inspection.
4. **Authorization**: `SessionGuard` on all routes except `GET /videos/:id`, where guard is optional and visibility is enforced in the service layer.
5. **Repository pattern**: follow existing pattern — `VideoRepository` interface with `InMemoryVideoRepository` and `PrismaVideoRepository` implementations, injected via module factory.
