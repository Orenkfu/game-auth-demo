# Outplayed Backend — Production Roadmap

This document tracks the transformation of the game-auth prototype into a production-grade backend
for the Outplayed platform. See [platform-strategy.md](platform-strategy.md) for the broader
context on Overwolf independence and auth migration.

---

## Current State

A working NestJS prototype covering:
- Discord + Riot OAuth (3-rule linking logic)
- Server-side session management (Redis-backed)
- Video upload/storage (S3 multipart, presigned URLs)
- Pluggable storage layer (in-memory ↔ Postgres, in-memory ↔ Redis)
- Basic Docker Compose stack (Redis, Postgres, MinIO)

**Gaps before production:** observability, infrastructure, CI/CD, API versioning, auth migration path.

---

## Target Architecture

```
Players / Clients
      │
  Cloudflare          ← DDoS, WAF, rate limiting, CDN, bot protection
      │
  AWS ALB             ← SSL termination, health checks, zero-downtime deploys
      │
  ECS (Fargate)       ← NestJS containers, auto-scaling
      │
  ┌───┴──────────────────┐
  RDS (Postgres)     ElastiCache (Redis)     S3 (video storage)
```

**Decisions locked:**
- Cloud: AWS (managed services preferred)
- Edge: Cloudflare (not AWS API Gateway — cloud-independent, better rate limiting for gaming)
- API versioning: global URI prefix (`/api/v1/`) via `app.enableVersioning()`
- Docs: `@nestjs/swagger` — enabled in non-production environments only UI-wise
- Session storage: Redis (server-side, instantly revocable — no JWTs)

---

## Phases

---

### Phase 1 — Security Hardening ✓
*Complete.*

#### 1.1 OAuth Token Encryption
Fields `accessTokenEncrypted` / `refreshTokenEncrypted` are stored plaintext today.
A DB breach exposes all provider credentials.

- Implement AES-256-GCM encryption in `OAuthAccountService.create()` and `.updateTokens()`
- Use Node's built-in `crypto.subtle` (no extra dependency)
- Store encryption key via `OAUTH_TOKEN_ENCRYPTION_KEY` env var (32-byte hex)
- Document key rotation procedure — needed for compliance later

#### 1.2 Rate Limiting
Auth endpoints are brute-forceable. Add `@nestjs/throttler`:

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/oauth/*/callback` | 10 req / min / IP |
| `POST /api/v1/oauth/*/link` | 5 req / min / IP |
| `GET /api/v1/auth/session` | 30 req / min / IP |
| `DELETE /api/v1/auth/logout` | 10 req / min / IP |
| Video upload endpoints | 20 req / min / identity |

Apply as guard at controller level, not globally — different resources have different tolerances.

#### 1.3 Error Message Sanitization
OAuth providers currently append raw provider error details to responses
(`discord.provider.ts`, `riot.provider.ts`). These can leak API internals or rate-limit state.

- Log full error server-side (structured log, see Phase 2)
- Return generic `"OAuth provider error"` to client
- Apply to all catch blocks in both providers

#### 1.4 Input Validation Gaps
- `InitiateUploadDto`: add `@Min(1)` and `@Max(10_000_000_000)` on `fileSize`
- `InitiateUploadDto`: add MIME type whitelist (`video/mp4`, `video/webm`, `video/quicktime`, etc.)
- `GetPartUrlsDto`: add `@ArrayMaxSize(10000)` on `partNumbers`

---

### Phase 2 — Observability
*Must be in place before production. Flying blind on auth events is not acceptable.*

**Observability stack: Datadog (fully managed).**

Single tool covering logs, metrics, traces, error tracking, dashboards, SLOs, and alerts.
AWS integration is native — RDS, ElastiCache, ECS, S3, CloudFront metrics flow in automatically.
No infrastructure to operate. Cost scales with usage but is negligible at early-stage traffic.

#### 2.1 Structured Logging
Replace NestJS default logger with **Pino** (`nestjs-pino`):
- JSON output — Datadog agent parses automatically
- Automatic request ID propagation (`X-Request-Id` header, injected into all log lines)
- Log level configurable via `LOG_LEVEL` env var

**Mandatory log events:**
| Event | Level | Fields |
|-------|-------|--------|
| Identity created | `info` | identityId, provider, email (masked) |
| OAuth link added | `info` | identityId, provider |
| Login (existing identity) | `info` | identityId, provider, ip |
| Login failed | `warn` | provider, reason, ip |
| Session revoked | `info` | identityId, sessionId, reason |
| Token refresh failed | `warn` | identityId, provider, error |
| Video upload completed | `info` | identityId, videoId, sizeBytes |
| Video upload aborted | `info` | identityId, videoId, reason |
| Admin action | `info` | adminId, action, targetId, changes |

#### 2.2 Metrics + Traces
- Enable Datadog APM agent in NestJS container (`dd-trace` auto-instrumentation)
- AWS integration covers all infrastructure metrics automatically (RDS, ElastiCache, ECS, S3)
- Distributed tracing across backend → ingestor → consumer out of the box

No Prometheus endpoint needed — Datadog agent handles metric collection.

#### 2.3 Error Tracking
Use Datadog Error Tracking — eliminates Sentry as a separate tool.
Exceptions grouped by fingerprint, frequency tracked, stack traces in context.

#### 2.4 Alerts
Two Slack channels, configured in Datadog:

- `#backend-warnings` — non-urgent, batched digest. High error rate, elevated latency,
  unusual auth failure patterns, ElastiCache memory pressure.
- `#backend-incidents` — immediate page. Service down, DB unreachable, sustained 5xx spike.
  **Zero false positive tolerance** — start with conservative thresholds and tighten over time.
  A channel that cries wolf gets ignored.

Email escalation on incidents if Slack page goes unacknowledged for 10 minutes.

#### 2.5 KPI Dashboards
Three dashboards in Datadog:

- **Operations** — uptime, p50/p95/p99 latency, error rate, ECS task health, DB connections
- **Auth** — logins/day by provider, new identity creation rate, link failures, session count
- **Videos** — uploads/day, bytes stored, upload failure rate, CDN cache hit ratio

#### 2.6 SLOs
Define before launch, not after:
- API availability: 99.9% (43 min downtime/month budget)
- Auth endpoint p95 latency: < 500ms
- Video upload initiation p95: < 300ms

#### 2.7 Health Checks
Implement `@nestjs/terminus` health endpoint at `/api/health`:
- Postgres connectivity check
- Redis connectivity check
- S3 bucket reachability check
- Used by ALB for health-based routing (not exposed via Cloudflare)

---

### Phase 3 — API & Developer Experience

#### 3.1 Global Versioning and Prefix
```typescript
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
// Result: /api/v1/auth/..., /api/v1/videos/...
```

All existing routes migrate to `v1`. No per-controller versioning.

#### 3.2 Swagger
```typescript
// Enabled in non-production only
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('api/docs', app, document);
}
// Schema endpoint /api/docs-json always available for internal tooling
```

Annotation priorities:
1. `@ApiTags` on all controllers (grouping)
2. `@ApiResponse` for non-obvious error cases (403, 409 link-required, 400 variants)
3. `@ApiProperty` on all DTO fields
4. `@ApiBearerAuth()` on authenticated endpoints

Do not annotate internal types, repository interfaces, or service methods.

#### 3.3 Test Token Seeding (Staging Only)
Provide a `POST /api/internal/seed-session` endpoint (staging env only) that returns a
pre-authenticated session token for a test identity. Eliminates the OAuth dance for QA
and client devs working against staging.

---

### Phase 4 — Infrastructure
*Run in parallel with Phases 1–3 for the staging environment.*

#### 4.1 AWS Baseline
| Service | Choice | Config |
|---------|--------|--------|
| Compute | ECS Fargate | 2 tasks minimum, auto-scale on CPU > 70% |
| Database | RDS PostgreSQL Multi-AZ | `db.t4g.medium` to start |
| Cache | ElastiCache Redis | `cache.t4g.medium`, cluster mode off initially |
| Storage | S3 | Versioning on, lifecycle rule: abort incomplete multipart after 24h |
| Video CDN | CloudFront → S3 | Origin Access Control, signed URLs for delivery |
| Container registry | ECR | Image scanning enabled, keep last 5 production images |
| Secrets | Secrets Manager | All secrets injected at task runtime, never baked into image |
| Logs | CloudWatch → Datadog | Log groups per environment, forwarded to Datadog agent |

#### 4.2 Orchestration
**ECS Fargate** for container orchestration — Kubernetes-grade autoscaling and rolling
deployments without the operational overhead of managing a cluster.

| GKE concept | ECS Fargate equivalent |
|-------------|----------------------|
| Deployment | ECS Service + Task Definition |
| Pod | Task |
| HPA | Application Auto Scaling policy |
| ConfigMap | Parameter Store / Secrets Manager |
| Ingress | ALB + Target Groups |
| Namespace | ECS Cluster per environment |

**AWS Copilot CLI** as the deployment UX layer — collapses the ECR push + task definition
update + rolling deploy into a single command used by CI/CD:
```bash
copilot svc deploy --name backend --env staging
```
Terraform owns infrastructure provisioning. Copilot owns the application deployment workflow.
They coexist cleanly — Copilot does not provision infrastructure in this setup.

#### 4.3 Provisioning
**Terraform + Terragrunt.**
- Terraform for all AWS resource definitions
- Terragrunt for environment parity — staging and production defined once, environment-specific
  values injected without HCL duplication
- Remote state: GitLab-managed Terraform state backend (built-in, no S3+DynamoDB setup needed)

```
infra/
  modules/
    ecs/
    rds/
    redis/
    s3/
    cloudfront/
  environments/
    staging/
    production/
```

#### 4.4 Cloudflare Setup
- Proxy all traffic through Cloudflare (orange-cloud DNS)
- Rate limiting rules mirroring Phase 1.2 as first line of defence
- WAF: OWASP ruleset enabled, gaming-specific bot rules
- Bypass cache for `/api/*`, cache static assets
- Origin certificate between Cloudflare and ALB (no public CA needed)

#### 4.5 CI/CD Pipeline
**GitLab CI.**

```yaml
# Abbreviated — full pipeline in .gitlab-ci.yml
test:      lint + type-check + unit tests          # every MR
build:     docker build → push to ECR              # merge to main
staging:   copilot svc deploy --env staging        # merge to main (automatic)
production: copilot svc deploy --env production    # tag v*.*.* (manual approval gate)
```

Key requirements:
- `npm run db:migrate` runs as a pre-deploy ECS one-off task, not on app startup
- Rollback = redeploy previous image tag via GitLab environment UI (one click)
- GitLab Environments used for deployment tracking — shows exactly what commit
  is live in staging vs production at all times

---

### Phase 5 — Auth Migration from Overwolf
*See [platform-strategy.md](platform-strategy.md) for full context.*

The migration moves existing Outplayed users from Overwolf's auth to this backend
without forcing them to re-authenticate. High-level phases:

#### 5.1 Shadow Provisioning (Month 1–2)
- On Overwolf-authenticated requests, silently create a shadow identity in this backend
- Verify OW token via OW's verification endpoint, extract provider (Discord/Riot) and email
- Link provider to newly created identity using existing 3-rule logic
- Respond identically — user experience unchanged

Open questions (from platform-strategy.md: OQ-1 through OQ-4) must be resolved before
implementation begins. Specifically: OW token verification contract and email availability.

#### 5.2 Cutover (Month 3)
- New app versions authenticate directly against this backend
- OW session tokens no longer accepted
- Monitor login success rate closely (Cloudflare + CloudWatch dashboards)

#### 5.3 Cleanup
- Remove shadow provisioning middleware
- Remove OW token verification code
- Archive migration telemetry

---

### Phase 6 — Platform Configuration & Admin

#### 6.1 Platform Settings Service
A `platform_settings` table for product-configurable values that should change without a deploy.
Cached in Redis, invalidated on write. Read by services at runtime rather than from env vars.

**Schema:**
```
platform_settings { key: string (PK), value: string, type: enum(string|number|boolean|json),
                    description: string, updatedAt, updatedBy }
```

Initial settings to migrate into it:
- Rate limiting thresholds (currently hardcoded in `@Throttle` decorators)
- Upload size cap (`STORAGE_MULTIPART_THRESHOLD_MB`)
- Session TTL (`SESSION_TTL_SECONDS`)
- Video MIME type allowlist

**Service interface:**
```typescript
platformSettings.get<T>(key: string, fallback: T): Promise<T>
platformSettings.set(key: string, value: unknown, updatedBy: string): Promise<void>
```

Settings are exposed to the admin panel as a first-class management surface. Changes are
audit-logged (who changed what and when).

#### 6.2 Admin Users
A separate `admins` table — never share with Identity (product users and operators are
different security domains).

**Schema:** `admins { id, email, passwordHash, role: enum(super_admin|support|viewer), createdAt, lastLoginAt }`

- Auth: email + bcrypt password (no OAuth dependency — OAuth providers can go down)
- Separate session store Redis key prefix (`admin:session:*`)
- Role-based access: `viewer` (read-only), `support` (user management), `super_admin` (everything)
- All admin actions audit-logged to a dedicated `admin_audit_log` table

Admin panel built as internal React app (separate repo/deployment from the Electron client).
See conversation context: agreed to build in React rather than use a generated tool.

#### 6.3 CDN Setup and Testing
Video delivery uses CloudFront in front of S3 — separate from the Cloudflare API layer.

**Architecture:**
```
Client → Cloudflare (API calls) → ALB → NestJS
Client → CloudFront (video delivery) → S3
```

Pre-signed download URLs generated by `getDownloadUrl()` point to the CloudFront domain
(already supported via `STORAGE_CDN_DOMAIN` env var). CloudFront uses Origin Access Control
(OAC) so S3 bucket is never publicly accessible.

**Test matrix before production:**
- Cache HIT / MISS headers present and correct
- Signed URL expiry enforced (request after TTL returns 403)
- Video deleted from S3 → CloudFront cache invalidated (need invalidation call on delete)
- Correct `Content-Type` and `Content-Disposition` headers for browser playback vs download
- Geographic latency baseline (CloudFront edge vs direct S3)

**Required backend change:** `VideosService.deleteVideo()` must trigger a CloudFront
invalidation for the deleted object's path after removing from S3.

#### 6.4 A/B Testing — Statsig
Statsig for feature flags and experiments. Two integration points:

**Server-side (NestJS):**
- `statsig-node` SDK initialised in a `StatsigModule`
- Used for API-level gates: new upload flow, rate limit experiments, feature rollouts
- Pass `identityId` as the Statsig user ID for consistent bucketing per user
- Platform settings (6.1) and Statsig are complementary — Statsig owns experiments
  with defined start/end, platform settings owns permanent operational config

**Client-side (Electron + future web):**
- `statsig-js` SDK initialised with the session user on login
- UI feature flags, onboarding experiments, monetisation tests

**Key decision:** server-side evaluation preferred for anything affecting API behaviour
(prevents clients from manipulating their own experiment assignment). Client-side only
for pure UI experiments.

---

### Phase 8 — Hardening (Post-Launch)
*After the first real users are on the system.*

- **Absolute session max age** — force re-auth after 30 days regardless of activity
- **Session binding** — bind session to user-agent string at minimum; reject on mismatch
- **Multi-device session management** — list active sessions per identity, revoke by device
- **Token refresh background job** — refresh provider tokens expiring within 24h (scheduled ECS task)
- **Video pagination** — cursor-based, shared helper for use across modules
- **UserProfile consolidation** — remove `UsersService` / `user.entity.ts` duplication,
  `UserProfile` is the single source of truth

---

## Code Debt to Clear Before Phase 1 Ships

These are not blocking but should be cleared before the codebase grows:

| Item | File | Notes |
|------|------|-------|
| `UsersService` uses in-memory Map, not repository | `users.service.ts` | Integrate with UserProfileRepository |
| `as unknown as Identity` type cast | `prisma-identity.repository.ts:11` | Explicit transformation function |
| State store TTL hardcoded | `storage.constants.ts` | Move to env var `STATE_TTL_SECONDS` |
| Coverage threshold at 10% | `package.json` | Raise to 60% minimum after video tests added |
| Video module has no tests | — | Unit tests for service, E2E for upload flow |

---

## Open Questions

| # | Question | Owner | Blocks |
|---|----------|-------|--------|
| OQ-1 | OW token verification endpoint contract | Overwolf platform team | Phase 5 |
| OQ-2 | Email availability from OW identity | Overwolf platform team | Phase 5 |
| OQ-3 | Handling already-logged-in OW users at cutover | Product | Phase 5 |
| OQ-4 | OW SDK payload fields available for shadow provisioning | Overwolf platform team | Phase 5 |
| ~~OQ-5~~ | ~~Log aggregation tooling~~ | ~~Resolved: Datadog~~ | — |
| ~~OQ-6~~ | ~~On-call ownership and alerting~~ | ~~Resolved: Datadog alerts → Slack~~ | — |
| OQ-7 | Social graph model — follower/following vs friend graph | Product | Post-launch |
| OQ-8 | Tebex subscription webhook integration point | Platform | Post-launch |
