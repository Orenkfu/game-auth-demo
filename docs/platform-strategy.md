# Outplayed Backend Platform — Strategy & Planning

## Context

Outplayed is being repositioned from a game clip utility into a **social platform**. For the first time, Outplayed is building its own dedicated backend, decoupling from Overwolf's shared platform APIs.

This document captures the architectural vision, migration strategy, and open questions surfaced during planning.

---

## Why Now

Outplayed currently depends on Overwolf's platform for:
- User authentication (OW client SDK + OW-owned auth modal)
- File upload and storage (bespoke OW microservice)
- Subscriptions (Tebex, via OW)
- Ads (OW ads platform)

As Outplayed matures into a standalone social platform, continued reliance on shared platform infrastructure is incompatible with owning our SLA, observability, and incident response.

---

## Goals

### Short-term: Decouple from Overwolf infra
- Own SLA and uptime guarantees
- Own observability (logging, alerting, health checks)
- Own resilience (no silent dependency failures)

### Medium/Long-term: Social platform features
- Friends, followers, likes
- Clip sharing and social feed
- User profiles with social graph
- Notification infrastructure

### What remains 3rd-party (intentionally)
- Analytics (e.g. Snowflake)
- Subscriptions (Tebex)
- Ads
- Observability tooling (e.g. Datadog, Sentry)

---

## Auth Migration Strategy

### The problem
The Outplayed client currently owns **zero** auth logic. Login is handled entirely by the Overwolf client SDK — an OW-owned modal manages all HTTPS calls and token management. Overwolf's database has no concept of "Outplayed users" — all users are OW platform users.

### Proposed approach: Shadow provisioning (2-month window)

**Phase 1 — Shadow writes (months 1–2)**
- Client sends an event to the Outplayed backend on OW auth events (login, logout, token refresh)
- Backend silently creates/updates Outplayed user records from the received user data
- No user-facing change; users continue to authenticate via OW as normal
- By end of phase, the Outplayed user table is populated for all active users

**Phase 2 — Auth switch**
- Outplayed client switches to native auth (Outplayed-owned flow)
- Users already in the system get a seamless transition
- Inactive users (no login in 2 months) onboard fresh — acceptable churn

### Open questions

**OQ-1: Token verification**
The backend cannot trust client-sent user data without independent verification. Two options:
- Client sends the OW session token alongside user data → backend validates against OW's user API (`GET /user/me` or token introspection endpoint). **Does OW expose such an endpoint to app developers?**
- OW is registered as an OAuth2 provider in the auth module. Client initiates OW OAuth, backend handles callback. **Does OW platform expose an OAuth2 flow for app developers?**

**OQ-2: Email availability**
The current identity model uses email as the primary identifier. **Does the OW SDK expose the user's email on the auth event payload?** If not, the identity model needs to accommodate an OW-userId-only primary key during the shadow period, with email linked later.

**OQ-3: Already-logged-in users**
Users who are already logged in when shadow provisioning ships won't trigger a login event. Strategy needed for bootstrapping these users — options: trigger on next app launch event, or on any API call.

**OQ-4: OW user data payload**
What fields does the OW SDK expose on auth events? Minimum needed: a stable unique user ID. Nice to have: username, display name, avatar URL, email.

**OQ-5: Session strategy during shadow period**
Should the backend issue its own Outplayed session tokens during Phase 1 (alongside OW tokens), or only start issuing them at the Phase 2 switch? Issuing early makes the switch day invisible to users.

---

## Observability (founding concern)

The new backend must treat observability as a day-1 concern, not a post-launch addition.

Minimum bar at launch:
- Structured logging on all requests (already partially in place via `LoggingMiddleware`)
- Health check endpoint (`GET /health`) that reports status of all dependencies (Redis, Postgres, S3/MinIO)
- Alerting on health check failures
- Dependency circuit breakers — a downstream failure should not cascade into a full outage

Open questions:
- **OQ-6: Observability tooling** — which platform? (Datadog, Sentry, Grafana Cloud, etc.)
- **OQ-7: On-call / alerting ownership** — who gets paged?

---

## Social Graph (future, design early)

Repositioning as a social platform requires data model decisions made now, not after the fact. Adding a social graph to a relational schema that wasn't designed for it is painful.

Minimum to consider upfront:
- `follows` table (follower_id → followee_id) — directional, asymmetric (Twitter-style, not Facebook-style)
- `likes` on videos
- Activity feed generation strategy (fan-out on write vs. fan-out on read)
- Notification infrastructure

**OQ-8:** Is the social graph Twitter-style (follow anyone, asymmetric) or Facebook-style (mutual friendship required)?

---

## Current Backend Modules (built so far)

| Module | Status | Notes |
|--------|--------|-------|
| Auth (OAuth) | Built | Discord + Riot providers; OW provider integration pending |
| Users / Profiles | Built | UserProfile separate from Identity |
| Videos | Built | Dual-path upload (single PUT + S3 multipart), MinIO local dev |
| Event pipeline | Built | Ingestor (Go) → Redis → Consumer (Go) → DuckDB |
