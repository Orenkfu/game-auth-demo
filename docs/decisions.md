# Outplayed Backend — Decision Register

> Single source of truth for architecture decisions. Every significant "X vs Y" choice lives here. When a later decision contradicts an earlier one, the earlier entry is marked **Superseded** and points forward.

---

## Legend

- **Status** — `Accepted` | `Superseded` | `Proposed` | `Rejected`
- **Date** — when the decision was made (ISO)
- **Context / Decision / Consequences** — compressed ADR format
- **Supersedes / Superseded by** — explicit cross-links when a prior position changed

---

## Index

| # | Decision | Status | Date |
|---|----------|--------|------|
| D-001 | Auth: fully self-managed backend | Accepted | 2026-04-23 |
| D-002 | Analytics warehouse: Snowflake | Accepted | 2026-04-23 |
| D-003 | Experimentation / feature flags: Statsig Warehouse Native | Accepted | 2026-04-23 |
| D-004 | Observability: Datadog | Accepted | 2026-04-22 |
| D-005 | Cloud: AWS + Cloudflare edge | Accepted | 2026-04 |
| D-006 | API sessions: server-side Redis sessions over JWT | Accepted | 2026-03 |
| D-007 | Primary database: managed PostgreSQL (RDS now, Aurora on EU trigger) | Accepted | 2026-04 |
| D-008 | OAuth provider linking: 3-rule model | Accepted | 2026-03 |
| D-009 | Identity vs UserProfile separation | Accepted | 2026-03 |
| D-010 | Storage layer: env-swappable via DI | Accepted | 2026-03 |
| D-011 | API protocol: REST with URI versioning | Accepted | 2026-03 |
| D-012 | Feed architecture at launch: pull-based at read time | Accepted | 2026-03 |
| D-013 | Counter consistency: sync for user-authored, async for aggregates | Accepted | 2026-03 |
| D-014 | Video object storage: S3 + CloudFront OAC (R2 reconsideration deferred) | Accepted | 2026-04 |
| D-015 | Streaming backbone: Kafka (managed) over Kinesis | Accepted | 2026-03 |
| D-016 | Analytics warehouse: ClickHouse Cloud | **Superseded** | 2026-03 |
| D-017 | Hybrid "build on Overwolf auth" | **Superseded** | 2026-03 |
| D-018 | Shadow-provisioning via OW auth events (2-month window) | **Superseded** | 2026-04 |
| D-019 | OAuth token encryption: AES-256-GCM at rest, decrypt on demand | Accepted | 2026-04 |

---

## D-001 — Auth: fully self-managed backend

- **Status:** Accepted
- **Date:** 2026-04-23
- **Supersedes:** D-017 (hybrid), D-018 (shadow provisioning)

**Context.** Outplayed has never owned its auth layer. The Overwolf client SDK handles login through an OW-owned modal; the Outplayed app sees an opaque session. Three options were considered:
1. Keep running on Overwolf platform auth (status quo).
2. Hybrid: Outplayed backend verifies OW-issued tokens ("OIDC federation with Overwolf").
3. Full ownership: Outplayed runs its own OAuth + session layer, decoupled from OW.

**Decision.** Option 3. The backend issues sessions via its own OAuth (Discord, Riot — extensible) and is not dependent on OW platform identity.

**Consequences.**
- The user-migration story becomes harder, not easier — we can't piggyback on OW auth events to populate our user table. Revisit after the 2026-04-29 handoff when we have real access.
- Velocity: we can ship auth features (email/password, MFA, device sessions) without waiting on another team.
- SLA: when OW's shared auth goes down, we're unaffected.
- Migration risk: existing users will need an explicit re-link flow at cutover. Do not underestimate the UX work.

---

## D-002 — Analytics warehouse: Snowflake

- **Status:** Accepted
- **Date:** 2026-04-23
- **Supersedes:** D-016 (ClickHouse Cloud)

**Context.** The prior architecture recommended ClickHouse Cloud for event analytics on cost and scan performance grounds. Post-handoff reality check: Overwolf already runs Snowflake for analytics. Running a second warehouse means duplicate ingest, duplicate modeling, and a second bill.

**Decision.** Snowflake. Piggyback on Overwolf's existing warehouse contract and dbt patterns.

**Consequences.**
- ClickHouse-specific decisions (Kafka engine ingest, dbt adapter validation) are moot.
- Statsig integration path is simpler (see D-003).
- Cost at gaming telemetry volumes is meaningfully higher than ClickHouse would have been; the price is paid for organizational alignment and reduced ops surface.
- The "Statsig × ClickHouse compatibility spike" is closed (not needed).

---

## D-003 — Experimentation / feature flags: Statsig Warehouse Native

- **Status:** Accepted
- **Date:** 2026-04-23

**Context.** Options: (a) build in-house, (b) managed (Statsig, LaunchDarkly, GrowthBook, Eppo, Optimizely). Building in-house means owning statistical significance, SRM detection, novelty controls, holdout groups, and guardrail metrics — 6–12 months of careful stats engineering for a small team. Managed wins on time-to-value.

**Decision.** Statsig Warehouse Native, reading from Snowflake (D-002). Server SDK for assignment keyed on `identityId`; client SDK for UI flags only.

**Consequences.**
- Session init must tolerate a Statsig outage: if the SDK call fails, return empty assignments with all flags in default-off state. Session init must never fail because Statsig is down.
- Experiment analysis runs on Snowflake marts via Statsig's warehouse-native tier — no event double-writing to a Statsig-operated store.
- Platform settings (permanent operational config) stay in our `platform_settings` table. Statsig owns time-boxed experiments and feature flags only.

---

## D-004 — Observability: Datadog

- **Status:** Accepted
- **Date:** 2026-04-22

**Context.** Three candidates: Datadog, Grafana Cloud, Elastic Observability. Ops surface must be minimized.

**Decision.** Datadog for logs, metrics, traces, errors, dashboards, and alerts — single tool. AWS infra metrics flow via native Datadog AWS integration.

**Consequences.**
- Structured logging via `nestjs-pino` JSON to stdout, shipped by the Datadog agent.
- APM via `dd-trace` auto-instrumentation.
- Alert channels: `#backend-warnings` (batched), `#backend-incidents` (immediate page). Email escalation after 10 min unacknowledged.
- Cost scales with log volume — revisit if event-pipeline logs dwarf API logs.

---

## D-005 — Cloud: AWS + Cloudflare edge

- **Status:** Accepted
- **Date:** 2026-04

**Decision.** AWS for compute/data (ECS Fargate, RDS, ElastiCache, S3, CloudFront). Cloudflare in front of ALB for DDoS, WAF, bot protection, rate limiting.

**Consequences.** Cloud-native services preferred (Secrets Manager, Parameter Store). Cloudflare WAF is first line of defence; app-level throttling via `@nestjs/throttler` is the second. Origin certificate between Cloudflare and ALB — no plain-HTTP hop.

---

## D-006 — API sessions: server-side Redis sessions over JWT

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** Opaque session token (UUID) → Redis lookup. Sliding-window TTL. No JWTs in the product auth layer.

**Consequences.**
- Instant revocation (delete the Redis key).
- Simpler mental model; no key rotation story for signed tokens.
- Redis outage = auth outage. Mitigated by ElastiCache Multi-AZ + session cache locality.

---

## D-007 — Primary database: managed PostgreSQL

- **Status:** Accepted
- **Date:** 2026-04

**Decision.** RDS PostgreSQL 16 Multi-AZ. Plan an Aurora Global Database migration path if/when EU active-active becomes a business requirement. Re-evaluation triggers in [open-questions.md](open-questions.md#rds-postgresql-vs-aurora-global-database).

**Trigger criteria for Aurora:** EU users >20% of traffic, or an EU latency SLA, or an incident where >1 min failover causes measurable business impact.

---

## D-008 — OAuth provider linking: 3-rule model

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** On OAuth callback:
1. **Rule 1** — `(provider, providerUserId)` already linked → log in.
2. **Rule 2** — no match → create new Identity + UserProfile + OAuthAccount.
3. **Rule 3** — verified email matches an existing Identity → throw `LinkRequiredException`; user must log in to the existing account and explicitly link.

**Consequences.** Prevents account hijacking via email collision on a second provider. Unverified emails use a placeholder (`{providerId}@{provider}.placeholder`) — Rule 2 applies.

---

## D-009 — Identity vs UserProfile separation

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** Two tables: `Identity` (auth concerns — email, status, lastLoginAt) and `UserProfile` (app concerns — username, avatar, bio, social graph keys). 1:1 relationship via `identityId` FK.

**Consequences.** Clean module boundary. Account merging and multiple identity providers are possible without reshaping app-side schema. A user deleting their account can delete Identity rows while keeping anonymized UserProfile data for moderation history, or vice versa.

---

## D-010 — Storage layer: env-swappable via DI

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** Every repository and cache has an interface + two implementations: in-memory (for local dev and unit tests) and the production implementation (Postgres / Redis). Toggles: `USE_POSTGRES`, `USE_REDIS`. Injected via Nest DI tokens — zero code changes to swap.

**Consequences.** Local dev runs with zero external dependencies. Unit tests don't require Docker. Must be disciplined: interface is the contract; the two implementations must behave identically where it matters for correctness.

---

## D-011 — API protocol: REST with URI versioning

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** REST over GraphQL. Global prefix `/api` + URI versioning (`/api/v1/…`) via `app.enableVersioning()`.

**Consequences.** Stable, known access patterns on a desktop client — REST is simpler to cache, debug, and version. Breaking changes ship as `v2`; `v1` deprecated with a deprecation window (target: 90 days).

---

## D-012 — Feed architecture at launch: pull-based at read time

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** Compute a user's feed at read time by joining `follows → clips` with `status = 'ready'`. Valid up to ~500 follows per user and ~50K DAU. Explicit migration path to materialized-per-user feed, then fanout-on-write, documented in the architecture spec.

**Consequences.** No feed-projection infrastructure at launch. Migration trigger: p95 feed latency > 300ms *or* a meaningful share of users cross the 500-follow threshold.

---

## D-013 — Counter consistency: sync for user-authored, async for aggregates

- **Status:** Accepted
- **Date:** 2026-03

**Decision.**
- `like_count`, `comment_count` → synchronous OLTP write in the same transaction as the triggering row. The user just performed the action and expects to see the result.
- `views_total`, `follower_count`, `clips_public_count` → eventual consistency via the operational pipeline (30–60s lag).

**Consequences.** Two different consistency models in the same schema — keep the boundary sharp. Spam-click debouncing is client-side (300ms), not Redis write-through.

---

## D-014 — Video object storage: S3 + CloudFront OAC

- **Status:** Accepted
- **Date:** 2026-04

**Decision.** S3 with CloudFront Origin Access Control, signed URLs, versioning, 30-day noncurrent-version expiry. R2 was the prior recommendation on egress-cost grounds, but is deferred pending: (a) the `outplayed.tv/media` migration story, (b) validation that R2's S3-compatible event notifications work for the transcoding pipeline.

**Consequences.** Higher egress cost than R2 at video-platform scale. Revisit once the migration story is clear — this is the most consequential cost decision in the stack and R2's zero-egress pricing is material at 100K clips/day.

---

## D-015 — Streaming backbone: Kafka (managed) over Kinesis

- **Status:** Accepted
- **Date:** 2026-03

**Decision.** Managed Kafka (Confluent Cloud or Redpanda Cloud — vendor spike still open). Two topics: `outplayed.events.client` (partitioned by `user_id`) and `outplayed.events.social` (partitioned by `clip_id`).

**Why not Kinesis.** Cloud-agnostic, replayable beyond 7 days, richer ecosystem (dbt, kafka-connect), two partition keys cleanly served by two topics. Full comparison in the prior architecture spec — collapsed here because the decision is closed.

**Consequences.** Operational burden > Kinesis. Offset by using a managed provider. The Go ingestor/consumer scaffolding in this repo is a placeholder for this pipeline — not the production design.

---

## D-016 — Analytics warehouse: ClickHouse Cloud *(Superseded)*

- **Status:** Superseded
- **Superseded by:** D-002 (Snowflake)
- **Date:** 2026-03

Original rationale: purpose-built for event analytics, 10–100x faster scans, significantly cheaper at gaming telemetry volumes. Closed because Overwolf already runs Snowflake — piggybacking on the existing warehouse eliminates a second ingest, a second modeling stack, and a second bill.

---

## D-017 — Hybrid "build on Overwolf auth" *(Superseded)*

- **Status:** Superseded
- **Superseded by:** D-001 (fully self-managed)
- **Date:** 2026-03

Original proposal: OIDC federation with Overwolf — backend verifies OW-issued tokens. Closed because the OW platform does not expose a standard OIDC flow to app developers, and velocity requires owning the full auth stack.

---

## D-018 — Shadow provisioning via OW auth events *(Superseded)*

- **Status:** Superseded
- **Superseded by:** D-001 (decision made before verifying the payload exists)
- **Date:** 2026-04

Original proposal: on OW auth events, client sends the session to the Outplayed backend; backend silently provisions an Outplayed Identity. Closed because:
1. The Overwolf user table does not distinguish "Outplayed users" from general-platform users — we cannot filter to the right cohort.
2. The Overwolf SDK's exposure of auth events to app developers is unverified.
3. Token introspection against OW is unverified.

These three unknowns are the "Migration Blockers" — see [platform-strategy.md](platform-strategy.md). Revisit post-handoff (2026-04-29) once we have real backend access.

---

## D-019 — OAuth token encryption: AES-256-GCM at rest, decrypt on demand

- **Status:** Accepted
- **Date:** 2026-04

**Context.** Provider OAuth tokens (Discord access/refresh, Riot access/refresh) are long-lived secrets. Storing them in plaintext in the `oauth_accounts` table is unacceptable — a read-only DB compromise would expose every user's provider-level access.

**Decision.** Encrypt at write with AES-256-GCM keyed by `OAUTH_TOKEN_ENCRYPTION_KEY` (64-char hex, 32 bytes). Decrypt on demand via `OAuthAccountService.getAccessToken(identityId, provider)` / `getRefreshToken(identityId, provider)`. IV per record; GCM tag stored alongside ciphertext. Format: `<iv_hex>:<tag_hex>:<ciphertext_hex>`.

**Consequences.**
- Rotating the key invalidates all stored tokens — mitigated because tokens refresh on every Rule-1 login (~7d cadence for Discord), so a full key rotation is recoverable within one session cycle plus a forced re-auth event for inactive users.
- Key is environment-scoped — never reuse across staging/prod. Validated at startup via the Zod env schema.
- No current consumer of `getAccessToken` / `getRefreshToken`; they exist so the first proxy-API feature (e.g. "refresh Discord user info", "fetch Riot match history") has a direct primitive instead of being tempted to pass raw ciphertext around.
- Encryption service is `OnModuleInit` — boots will fail fast if the key is missing or malformed.

---

## Migration Blockers (informational, not decisions)

Three unresolved dependencies that gate the migration plan, tracked here so they're visible to every architecture decision that touches auth or user data:

1. **Outplayed users are indistinguishable in OW's user table.** Cannot do a filtered export.
2. **Outplayed uses the Overwolf SDK for auth.** The client is coupled to OW's platform — decoupling requires a client SDK change we do not yet control.
3. **Clip storage at `outplayed.tv/media` is opaque.** Bucket ownership and the user→clip mapping are not visible to the Outplayed team.

Revisit after the 2026-04-29 handoff.
