# Outplayed Backend — Production Roadmap

See [platform-strategy.md](platform-strategy.md) for context on Overwolf independence and auth migration. Decisions locked with full rationale in [decisions.md](decisions.md).

---

## Current State

NestJS backend with Discord + Riot OAuth (3-rule linking), Redis sessions, S3 multipart video uploads, env-swappable storage (in-memory ↔ Postgres ↔ Redis), health/readiness endpoints, Docker Compose dev stack.

---

## Target Architecture

See [architecture.md §1](architecture.md#1-system-overview) for the current and target system diagram.

**Decisions locked:**
- Auth: fully self-managed (D-001)
- Cloud: AWS + Cloudflare edge (D-005)
- API: global URI prefix `/api/v1/` (D-011)
- Sessions: Redis sliding-window (D-006)
- Primary DB: RDS Postgres Multi-AZ; Aurora on EU trigger (D-007)
- Warehouse: Snowflake via Overwolf's existing infrastructure (D-002)
- Experimentation: Statsig Warehouse Native on Snowflake (D-003)
- Observability: Datadog (D-004)
- Streaming: managed Kafka (D-015)
- Video storage: S3 + CloudFront OAC (D-014)

---

### Phase 1 — Security Hardening ✓

- AES-256-GCM OAuth token encryption at rest (D-019)
- Per-endpoint rate limiting via `@Throttle`
- Provider error sanitization (log full, return generic)
- DTO validation (MIME whitelist, 10 GB cap, part array limit)
- Helmet middleware
- CORS origin hardening (URL-validated parsing)
- Zod env validation at startup with placeholder-secret detection

---

### Phase 2 — Observability

**Stack: Datadog (D-004).** Single tool for logs, metrics, traces, errors, dashboards, alerts. AWS infra metrics via native integration.

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
`dd-trace` auto-instrumentation. AWS infra metrics (RDS, Redis, ECS, S3, CloudFront) via native Datadog AWS integration.

#### 2.3 Alerts
- `#backend-warnings` — batched digest: high error rate, elevated latency, auth failures, Redis pressure
- `#backend-incidents` — immediate page: service down, DB unreachable, sustained 5xx. Email escalation after 10 min unacknowledged.

#### 2.4 Dashboards
- **Operations** — uptime, p50/p95/p99 latency, error rate, ECS health, DB connections
- **Auth** — logins/day by provider, new identities, link failures, session count
- **Videos** — uploads/day, bytes stored, failure rate, CDN cache hit ratio

#### 2.5 SLOs
- API availability: 99.9%
- Auth p95 latency: < 500ms
- Video upload initiation p95: < 300ms

#### 2.6 Health Checks ✓
`@nestjs/terminus` at `/api/health/live` (liveness) and `/api/health/ready` (readiness — Postgres + Redis). Used by ALB.

---

### Phase 3 — API & Developer Experience

#### 3.1 Global Versioning ✓
`app.setGlobalPrefix('api')` + `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.

#### 3.2 Swagger
Enabled in non-production only. `@ApiTags` on all controllers, `@ApiResponse` for non-obvious errors, `@ApiProperty` on DTOs, `@ApiBearerAuth` on authenticated endpoints. Schema at `/api/docs-json`.

#### 3.3 Staging Seed Endpoint
`POST /api/internal/seed-session` (staging only) — pre-authenticated session for a test identity. Eliminates the OAuth dance for QA and client devs.

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
Terraform owns infra provisioning. Copilot owns app deployment.

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
- Rollback = redeploy previous image tag via GitLab Environments

#### 4.5 Infra hardening (pending)

| Item | Priority | Notes |
|------|----------|-------|
| `TF_VAR_db_password` → Secrets Manager data source | High | Currently a TF variable — lands in state file and shell history |
| Staging → production promotion workflow | Medium | Undocumented; needed before first prod deploy |
| RDS: enable `iam_database_authentication_enabled` | Medium | Also document PITR process and rotation cadence |
| TF module variables: add `description` + `validation` blocks | Low | Usability for future contributors |
| Hoist common values (project, aws\_region) to root `terragrunt.hcl` | Low | Currently repeated per-environment |
| Infra DR runbook | High | State bucket loss, stuck DynamoDB lock, RDS point-in-time restore — add to operations.md |

---

### Phase 5 — Auth Migration from Overwolf

**Blocked: post-handoff.** The three migration blockers ([platform-strategy.md](platform-strategy.md#migration-blockers)) gate any concrete plan. The earlier shadow-provisioning design is superseded (D-018).

Until those blockers are resolved post-handoff: new-user flow runs entirely on self-managed auth (D-001). Existing-user migration is out of scope.

---

### Phase 6 — Platform Configuration & Admin

#### 6.1 Platform Settings
`platform_settings` table — product-configurable values cached in Redis.

Schema: `{ key PK, value, type: string|number|boolean|json, description, updatedAt, updatedBy }`

Interface: `platformSettings.get<T>(key, fallback)` / `platformSettings.set(key, value, updatedBy)`

Initial settings: rate limit thresholds, upload size cap, session TTL, video MIME allowlist. All changes audit-logged; all exposed in admin panel.

#### 6.2 Admin Users
Separate `admins` table — never shared with Identity.

Schema: `{ id, email, passwordHash, role: super_admin|support|viewer, createdAt, lastLoginAt }`

- bcrypt auth (no OAuth dependency)
- Redis key prefix `admin:session:*`
- All actions audit-logged to `admin_audit_log`

#### 6.3 CDN Wiring
`VideosService.deleteVideo()` must trigger a CloudFront invalidation after S3 delete.

Pre-production test matrix: cache HIT/MISS headers correct, signed URL expiry enforced, invalidation fires on delete, correct `Content-Type`/`Content-Disposition`.

#### 6.4 A/B Testing — Statsig Warehouse Native
Decision: D-003.
- Server-side (`statsig-node`): API-level gates, keyed on `identityId`
- Client-side (`statsig-js`): UI flags only
- Statsig owns time-boxed experiments and feature flags; `platform_settings` owns permanent operational config
- **Fallback invariant:** if Statsig SDK call fails, return empty assignments, flags default-off. Session init must never fail because Statsig is down.

---

### Phase 7 — Go Services Hardening

The Go ingestor/consumer are scaffolding today (Redis + DuckDB). Before graduating to the Kafka/Snowflake production design, each needs:

| Item | Service | Priority |
|------|---------|----------|
| Redis reconnect loop — `BRPOP` failures currently kill the goroutine silently | consumer | High |
| TLS option for Redis client | both | High (required before non-dev deploy) |
| README: event schema, DuckDB schema, error semantics | both | Medium |

---

### Phase 8 — Post-Launch Hardening

- Auth rate limiting: tighten `validateSession` from 30 → 10 req/min (currently too loose for auth-critical path)
- Session max age: 30 days absolute, force re-auth
- Session binding: reject on user-agent mismatch
- Multi-device session management (list + revoke by device)
- Token refresh background job (ECS scheduled task, refresh tokens expiring < 24h)
- Video pagination: cursor-based
- Account linking UI
- Email/password auth + email verification
- Frontend: validate OAuth window URL in main process

---

## Code Debt

| Item | Location |
|------|----------|
| `as unknown as Entity` casts in Prisma repositories | `prisma-*.repository.ts` — Prisma's generated types diverge from domain entities; tracked until either types align or a mapper layer is added |
| Coverage threshold at 10% | `package.json` — raise to 60% after video module tests are written |
| Video module has no tests | — |
| `validateSession` rate limit at 30/min | `oauth.controller.ts:218` — too loose for auth endpoint |

---

## Open Questions

| # | Question | Blocks |
|---|----------|--------|
| OQ-1 | Migration blocker: filtered export of Outplayed users from OW's user table | Phase 5 |
| OQ-2 | Migration blocker: client SDK hooks for overriding OW auth flow | Phase 5 |
| OQ-3 | Migration blocker: `uploads.outplayed.tv/media` bucket ownership + user→clip mapping | Phase 5 |
| OQ-6 | Social graph: follower/following vs mutual-friend model | Post-launch |
| OQ-7 | Tebex subscription webhook integration point | Post-launch |
