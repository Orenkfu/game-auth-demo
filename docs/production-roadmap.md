# Outplayed Backend — Production Roadmap

See [platform-strategy.md](platform-strategy.md) for context on Overwolf independence and auth migration.

---

## Current State

NestJS backend with Discord + Riot OAuth (3-rule linking), Redis sessions, S3 video uploads, pluggable storage layer (in-memory ↔ Postgres ↔ Redis), Docker Compose dev stack.

**Remaining gaps:** observability, CI/CD, admin panel, auth migration.

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
- Edge: Cloudflare (cloud-independent, better rate limiting for gaming)
- API: global URI prefix `/api/v1/` via `app.enableVersioning()`
- Sessions: Redis (server-side, instantly revocable — no JWTs)
- Observability: Datadog (logs, metrics, traces, errors, alerts — single tool)

---

### Phase 1 — Security Hardening ✓
AES-256-GCM OAuth token encryption, per-endpoint rate limiting (`@Throttle`), provider error sanitization (log full error, return generic), DTO validation (MIME whitelist, 10 GB file size cap, part array limit).

---

### Phase 2 — Observability

**Stack: Datadog.** Single tool for logs, metrics, traces, errors, dashboards, alerts. AWS infra metrics flow in via native integration — no infrastructure to operate.

#### 2.1 Structured Logging
Replace NestJS logger with **Pino** (`nestjs-pino`): JSON output, `X-Request-Id` propagation, `LOG_LEVEL` env var.

**Mandatory log events:**
| Event | Level | Fields |
|-------|-------|--------|
| Identity created | `info` | identityId, provider, email (masked) |
| OAuth link added | `info` | identityId, provider |
| Login | `info` | identityId, provider, ip |
| Login failed | `warn` | provider, reason, ip |
| Session revoked | `info` | identityId, sessionId, reason |
| Token refresh failed | `warn` | identityId, provider, error |
| Video upload completed | `info` | identityId, videoId, sizeBytes |
| Video upload aborted | `info` | identityId, videoId, reason |
| Admin action | `info` | adminId, action, targetId, changes |

#### 2.2 APM + Traces
`dd-trace` auto-instrumentation in the NestJS container. AWS infra metrics (RDS, Redis, ECS, S3, CloudFront) via native Datadog AWS integration.

#### 2.3 Alerts
- `#backend-warnings` — batched digest: high error rate, elevated latency, auth failures, Redis pressure
- `#backend-incidents` — immediate page: service down, DB unreachable, sustained 5xx. Zero false-positive tolerance — start conservative. Email escalation after 10 min unacknowledged.

#### 2.4 Dashboards
- **Operations** — uptime, p50/p95/p99 latency, error rate, ECS health, DB connections
- **Auth** — logins/day by provider, new identities, link failures, session count
- **Videos** — uploads/day, bytes stored, failure rate, CDN cache hit ratio

#### 2.5 SLOs
- API availability: 99.9%
- Auth p95 latency: < 500ms
- Video upload initiation p95: < 300ms

#### 2.6 Health Checks
`@nestjs/terminus` at `/api/health` — Postgres, Redis, S3 checks. Used by ALB; not exposed via Cloudflare.

---

### Phase 3 — API & Developer Experience

#### 3.1 Global Versioning ✓
Already in `main.ts` — `app.setGlobalPrefix('api')` + `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.

#### 3.2 Swagger
Enabled in non-production only. Annotation priorities: `@ApiTags` on all controllers, `@ApiResponse` for non-obvious errors (403, 409 link-required), `@ApiProperty` on DTOs, `@ApiBearerAuth` on authenticated endpoints. Schema at `/api/docs-json` always available.

#### 3.3 Staging Seed Endpoint
`POST /api/internal/seed-session` (staging only) — returns a pre-authenticated session for a test identity. Eliminates the OAuth dance for QA and client devs.

---

### Phase 4 — Infrastructure

#### 4.1 AWS Baseline ✓ (scaffolded in `infra/`)
| Service | Config |
|---------|--------|
| ECS Fargate | 2 tasks min, auto-scale on CPU > 70% |
| RDS PostgreSQL Multi-AZ | `db.t4g.medium`, 14-day backup retention |
| ElastiCache Redis | `cache.t4g.medium`, at-rest encryption |
| S3 + CloudFront | OAC, signed URLs, versioning, 30-day noncurrent expiry |
| ECR | Image scanning, immutable tags |
| Secrets Manager | Injected at task runtime, never baked into image |

Terraform + Terragrunt, S3 remote state + DynamoDB locking — see `infra/README.md`.

#### 4.2 Deployment
**AWS Copilot CLI** collapses ECR push + task definition update + rolling deploy into one command:
```bash
copilot svc deploy --name backend --env staging
```
Terraform owns infra provisioning. Copilot owns app deployment. They coexist — Copilot does not provision infra.

#### 4.3 Cloudflare
- Proxy all traffic (orange-cloud DNS)
- Rate limiting mirroring Phase 1 limits as first line of defence
- WAF: OWASP ruleset + gaming bot rules
- Bypass cache for `/api/*`
- Origin certificate between Cloudflare and ALB

#### 4.4 CI/CD (GitLab)
```
test:        lint + type-check + unit tests      # every MR
build:       docker build → push to ECR          # merge to main
staging:     copilot svc deploy --env staging    # merge to main (auto)
production:  copilot svc deploy --env production # tag v*.*.* (manual gate)
```
- `db:migrate` runs as a pre-deploy ECS one-off task, not on app startup
- Rollback = redeploy previous image tag via GitLab Environments (one click)

---

### Phase 5 — Auth Migration from Overwolf
*Blocked on OQ-1 through OQ-5 in [platform-strategy.md](platform-strategy.md).*

1. **Shadow provisioning (months 1–2)** — on OW-authenticated requests, silently create/link Outplayed identities. No user-facing change.
2. **Cutover (month 3)** — new app versions authenticate directly against this backend. OW tokens no longer accepted.
3. **Cleanup** — remove shadow middleware and OW token verification code.

---

### Phase 6 — Platform Configuration & Admin

#### 6.1 Platform Settings
`platform_settings` table — product-configurable values that change without a deploy, cached in Redis.

Schema: `{ key PK, value, type: string|number|boolean|json, description, updatedAt, updatedBy }`

Interface: `platformSettings.get<T>(key, fallback)` / `platformSettings.set(key, value, updatedBy)`

Initial settings: rate limit thresholds, upload size cap, session TTL, video MIME allowlist. All changes audit-logged; all exposed in admin panel.

#### 6.2 Admin Users
Separate `admins` table — never shared with Identity.

Schema: `{ id, email, passwordHash, role: super_admin|support|viewer, createdAt, lastLoginAt }`

- bcrypt auth (no OAuth dependency — OAuth providers can go down)
- Redis key prefix `admin:session:*`
- All actions audit-logged to `admin_audit_log`
- Admin panel: internal React app (separate repo)

#### 6.3 CDN Wiring
`VideosService.deleteVideo()` must trigger a CloudFront invalidation after S3 delete.

Pre-production test matrix: cache HIT/MISS headers correct, signed URL expiry enforced (403 after TTL), invalidation fires on delete, correct `Content-Type`/`Content-Disposition` for playback vs download.

#### 6.4 A/B Testing — Statsig
- Server-side (`statsig-node`): API-level gates, keyed on `identityId` for consistent bucketing
- Client-side (`statsig-js`): UI flags and experiments only
- Statsig owns time-boxed experiments; platform settings owns permanent operational config

---

### Phase 8 — Post-Launch Hardening
- Session max age: 30 days absolute, force re-auth
- Session binding: reject on user-agent mismatch
- Multi-device session management (list + revoke by device)
- Token refresh background job (ECS scheduled task, refresh tokens expiring < 24h)
- Video pagination: cursor-based
- UserProfile consolidation: remove `UsersService` / `user.entity.ts` duplication

---

## Code Debt

| Item | Location |
|------|----------|
| `UsersService` uses in-memory Map, not repository | `users.service.ts` |
| `as unknown as Identity` cast | `prisma-identity.repository.ts:11` |
| Coverage threshold at 10% | `package.json` — raise to 60% after video tests |
| Video module has no tests | — |

---

## Open Questions

| # | Question | Owner | Blocks |
|---|----------|-------|--------|
| OQ-1–5 | Auth migration blockers (token verification, email, payload, session strategy) | Overwolf platform team / Product | Phase 5 — details in [platform-strategy.md](platform-strategy.md) |
| OQ-6 | Social graph: follower/following vs friend model | Product | Post-launch |
| OQ-7 | Tebex subscription webhook integration point | Platform | Post-launch |
