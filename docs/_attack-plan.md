# Attack Plan — 2026-04-23 session

> **Ephemeral.** Delete when the 7 items below are complete or superseded. This is a working scratchpad for a single session's worth of work, not documentation. Handoff deadline: **2026-04-29** (Wednesday, +6 days).

---

## Fixed decisions (as of 2026-04-23)

These are committed. Persisted to memory. Backport into all docs during step 2 below.

| Area | Decision | Reason |
|---|---|---|
| Auth ownership | **Fully self-managed** | OW platform auth insufficient; velocity demands ownership |
| Analytics warehouse | **Snowflake** | OW already runs it — piggyback, don't duplicate |
| Experimentation / flags | **Statsig (Warehouse Native on Snowflake)** | In-house A/B = 6–12mo of stats work; Statsig + Snowflake pair cleanly |
| Observability | **Datadog** | Single tool, AWS-native, solo backend |
| ClickHouse | **Rejected** | Superseded by Snowflake decision |
| Statsig × ClickHouse spike | **Closed (moot)** | Snowflake decision resolves it |
| Overwolf-hybrid auth (Option 2 in old auth.md) | **Rejected** | Superseded by self-managed decision |

## Known unresolved unknowns (hunt before 2026-04-29)

1. Which Overwolf API endpoints can identify Outplayed users specifically?
2. What mechanism (if any) exists to emit per-app auth events to us?
3. Where does the `outplayed.tv/media` bucket actually live, and who owns the credentials?
4. What is the schema for the user→clip ownership relationship inside OW's backend?
5. How does the current "delete my video" path work end-to-end (if at all)?
6. Does the Overwolf SDK expose hooks for us to override the auth flow from the client side?
7. Is there a read-replica or snapshot of the user table we can query offline even without a filtered export?

*Add more as they surface. Empty list = we haven't asked enough questions yet.*

---

## 7-item plan

### 1. Collapse docs: Outplayed-BE-Practice → game-auth repo, dedupe
- [x] Inventory overlap between `../Outplayed-BE-Practice/{executive-summary,auth,features,readme,architecture.mmd}` and `game-auth/{README,ARCHITECTURE,docs/*}` — done
- [x] Choose canonical home per topic:
  - Business case/costs/timeline → `docs/business-case.md` (created, superseded decisions flagged in header)
  - Architecture spec → `docs/architecture.md` (new, merged + trimmed; old root ARCHITECTURE.md deleted)
  - Decision register → `docs/decisions.md` (new, 18 ADRs including all 2026-04-23 decisions)
  - Feature specs → `docs/features.md` (copied, superseded decisions flagged in header)
  - Auth strategy → folded into `docs/decisions.md` as D-001 (accepted), D-017 + D-018 (superseded). Old `auth.md` not duplicated.
- [ ] Delete `../Outplayed-BE-Practice/` only after content is absorbed and verified (NOT during this session)

### 2. Advance docs with concrete decisions now made
- [x] In `docs/decisions.md`: add ADR entries for auth self-management (D-001), Snowflake (D-002), Statsig (D-003), Datadog (D-004)
- [x] Strike ClickHouse / Statsig-ClickHouse-spike / hybrid-auth — superseded entries cross-link forward (D-016, D-017, D-018)
- [x] "Migration Blockers" section documenting the three hard unknowns — in decisions.md + platform-strategy.md
- [x] Mark all migration-dependent roadmap items as `BLOCKED: post-handoff` — Phase 5 updated in production-roadmap.md

### 3. Cut noise by 50%+
- [x] Kinesis-vs-Kafka collapsed to 1 line in decisions.md (D-015)
- [x] Headcount + Timeline + Capacity Model stay in business-case.md, not in architecture.md (architecture.md has none of it)
- [x] Architecture doc cut from 435 lines (old ARCHITECTURE.md) to ~300 lines (docs/architecture.md) with more content + no cost tables + no headcount
- [x] Cost tables removed from architecture — live only in business-case.md
- [x] `auth.md` (10kb) not duplicated — absorbed into decisions.md as D-001 / D-017 / D-018
- [ ] Further collapse of schema duplication between architecture.md §7 and features.md — deferred; both docs currently cite the same source, one lightweight (architecture) and one detailed (features). Acceptable.

### 4. Separate ADR from README
- [x] `game-auth/README.md` rewritten: project brief + quick start + link list. Nothing else.
- [x] `game-auth/ARCHITECTURE.md` deleted; content moved to `docs/architecture.md`
- [x] ADR-style decisions in `docs/decisions.md` with Status/Date/Context/Decision/Consequences + Supersedes cross-links

### 5. Resolve code-review punch list (from earlier in session)
Priority by risk × effort:
- [x] **P0** Fix `SessionGuard` hardcoded TTL — done, 2 regression tests added
- [x] **P0** Lowercase email before `findByEmail` in Rule 3 — done as boundary hygiene; **note:** repo layer already lowercases (identity.repository.ts, prisma-identity.repository.ts, identity.service.ts), so this was defense-in-depth + cleaner exception payload, not a correctness fix. Original review framing overstated severity.
- [x] **P1** Add Zod env validation in `ConfigModule.forRoot({ validate })` — `app.module.ts`
- [x] **P1** Add Helmet middleware — `main.ts`
- [x] **P1** Harden CORS origin parsing (trim + URL validation)
- [x] **P2** Repositories: stop swallowing all errors; only catch `P2025`, rethrow rest
- [x] **P2** Stub Users endpoints deleted (never registered in UsersModule — safe to remove)
- [x] **P3** Kept encrypt-side code; added `getAccessToken`/`getRefreshToken` primitives; documented in D-019

### 6. Record new decisions in ADR
(Folded into step 2, but calling it out as its own checkbox for discipline)
- [x] Each decision in `docs/decisions.md` has: **Status** (accepted/rejected/superseded), **Date**, **Context**, **Decision**, **Consequences**, **Supersedes/Superseded by** (if applicable)
- [x] Any decision that contradicts a prior doc's recommendation must explicitly mark the prior recommendation as **superseded**

### 7. Continue production-readiness plan
After code-review fixes land:
- [x] `@nestjs/terminus` health + readiness endpoints (`/api/health/live`, `/api/health/ready`)
- [x] `app.enableShutdownHooks()` in `main.ts`
- [x] Prisma onModuleInit retry w/ backoff (5 attempts, 500ms→8s)
- [x] Placeholder-secret detection at startup (env.schema.ts `your_client_id` / `your_client_secret` / `your_riot_client_id`)
- [x] Root `terragrunt.hcl`: S3 backend already configured; added `required_providers` pinning AWS ~> 5.60
- [x] Write `docs/operations.md` (runbooks: backend down, Postgres disk full, Redis eviction, OAuth provider outage, token key incident, deploy rollback)

---

## Working order

Not strictly sequential, but sensible dependencies:

1. Steps 5 (P0 bugs) first — 30 min, clears correctness debt
2. Step 1 + 4 (doc restructure) — sets the skeleton everything else slots into
3. Step 2 + 6 (record decisions) — feeds step 3's cuts
4. Step 3 (noise cut) — last because you can't cut confidently until structure exists
5. Step 5 (P1/P2/P3) and Step 7 (prod-readiness) interleaved after structure lands

## What I'm NOT doing this session

- Deleting `../Outplayed-BE-Practice/` (only after human review of merged result)
- Migrating any clip/user data (blocked)
- Designing OW SDK replacement (pre-handoff, insufficient info)
- Building the admin moderation tool
- Writing the event pipeline spec for Snowflake — that's after the backend handoff closes the Kafka-vs-Kinesis-vs-Firehose question

---

*When the above is done or the session ends, delete this file.*
