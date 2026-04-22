# Outplayed Backend Platform — Strategy

## Context

Outplayed is being repositioned from a game clip utility into a **social platform**. For the first time, Outplayed is building its own dedicated backend, decoupling from Overwolf's shared platform APIs.

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
- Analytics (Snowflake)
- Subscriptions (Tebex)
- Ads
- Observability (Datadog)

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

### Open questions (block Phase 5 in roadmap)

**OQ-1: Token verification**
The backend cannot trust client-sent user data without independent verification. Two options:
- Client sends the OW session token → backend validates against OW's user API. **Does OW expose a token introspection endpoint to app developers?**
- OW registered as an OAuth2 provider. **Does OW platform expose an OAuth2 flow for app developers?**

**OQ-2: Email availability**
The current identity model uses email as the primary identifier. **Does the OW SDK expose the user's email on auth events?** If not, the identity model needs to accommodate an OW-userId-only primary key during the shadow period.

**OQ-3: Already-logged-in users**
Users already logged in when shadow provisioning ships won't trigger a login event. Options: trigger on next app launch, or on any API call.

**OQ-4: OW user data payload**
What fields does the OW SDK expose on auth events? Minimum: a stable unique user ID. Nice to have: username, display name, avatar URL, email.

**OQ-5: Session strategy during shadow period**
Should the backend issue Outplayed session tokens during Phase 1 (alongside OW tokens), or only at the Phase 2 switch? Issuing early makes the cutover invisible to users.

---

## Social Graph (design early)

Adding a social graph after the fact to a relational schema is painful. Minimum to consider upfront:
- `follows` table (follower_id → followee_id) — directional, asymmetric
- `likes` on videos
- Activity feed: fan-out on write vs. fan-out on read
- Notification infrastructure

**OQ-6:** Twitter-style (follow anyone, asymmetric) or Facebook-style (mutual friendship required)?
