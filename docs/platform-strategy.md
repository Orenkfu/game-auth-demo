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

### Direction (confirmed 2026-04-23)

Outplayed owns its auth layer end-to-end. Self-managed OAuth (Discord, Riot — extensible), server-side Redis sessions. No dependency on Overwolf platform identity. See [decisions.md D-001](decisions.md#d-001--auth-fully-self-managed-backend).

### The problem

The Outplayed client currently owns **zero** auth logic. Login is handled entirely by the Overwolf client SDK — an OW-owned modal manages all HTTPS calls and token management. Overwolf's database has no concept of "Outplayed users" — users exist at the OW platform level.

### Migration Blockers (hunt before 2026-04-29 handoff)

Three unknowns gate any concrete migration plan. These are listed in [decisions.md](decisions.md#migration-blockers-informational-not-decisions):

1. **Outplayed users are indistinguishable in OW's user table.** Cannot do a filtered export. Confirmed from previous scoping work — OW cannot tell us "these N users are your users."
2. **The Outplayed client uses the Overwolf SDK for auth.** Decoupling requires a client-side SDK change that is not yet within our control.
3. **Clip storage at `uploads.outplayed.tv/media` is opaque.** Bucket ownership and the user→clip mapping are not visible to us. No user ID in the storage path.

### Superseded: shadow provisioning via OW auth events

An earlier draft proposed a 2-month shadow-write window where the client would emit OW auth events to the Outplayed backend, silently populating our user table. That plan is superseded ([D-018](decisions.md#d-018--shadow-provisioning-via-ow-auth-events-superseded)) because:

- The client-side event emission depends on SDK hooks we have not verified exist.
- Token verification against OW requires an introspection endpoint that has not been confirmed exposed to app developers.
- Even with perfect event capture, OW cannot distinguish "Outplayed users" from general-platform users — so we would shadow-provision every OW user, not our cohort.

The migration plan will be redesigned post-handoff once we have real access to confirm or rule out these assumptions.

### Interim (pre-handoff) work

- Backend runs fully self-managed auth for new users (Discord + Riot working; credential-pending Riot).
- Client decoupling is scoped, not scheduled — depends on what the handoff surfaces.
- Migration of existing users is explicitly out of scope until the three blockers above are resolved.

---

## Social Graph (design early)

Adding a social graph after the fact to a relational schema is painful. Minimum to consider upfront:
- `follows` table (follower_id → followee_id) — directional, asymmetric
- `likes` on videos
- Activity feed: fan-out on write vs. fan-out on read
- Notification infrastructure

Open question: Twitter-style (follow anyone, asymmetric) or Facebook-style (mutual friendship required)? See OQ-6 in [production-roadmap.md](production-roadmap.md#open-questions).
