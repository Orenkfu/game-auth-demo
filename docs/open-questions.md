# Open Questions & Deferred Decisions

Things that are **not yet decided** or **decided but with a known re-evaluation trigger**. The complement to [decisions.md](decisions.md), which tracks what is locked.

An item leaves this list when it either gets a decision (→ decisions.md) or gets explicitly closed as won't-decide.

---

## Pending Vendor Spikes

### Kafka provider: Confluent Cloud vs Redpanda Cloud

D-015 locks Kafka as the streaming backbone. The managed provider is still open.

- **Confluent Cloud** — industry standard, mature ecosystem, higher price
- **Redpanda Cloud** — Kafka-compatible API, lower cost, simpler ops, Kafka-compatible tooling works as-is

Decide before the event pipeline goes to production. Neither requires a code change — both expose the standard Kafka client API.

### Search: Typesense vs Algolia

Phase 1 uses `pg_trgm`. When relevance or latency requires a dedicated index (see features.md §Search), choose between:

- **Typesense Cloud** — open-source core, predictable pricing, self-hostable if needed
- **Algolia** — more mature, richer relevance tuning, higher price

Decide when pg_trgm latency becomes a problem.

---

## Infrastructure Tech Debt (Personal AWS → Work Environment)

### TLS / HTTPS on the ALB

The ALB module currently runs HTTP-only. The HTTPS listener and `certificate_arn` input are implemented but gated behind `certificate_arn != null`. When moving to the work AWS account:

1. Register a domain and request a public ACM certificate for it.
2. Set `certificate_arn` in `environments/staging/alb/terragrunt.hcl` and `environments/production/alb/terragrunt.hcl`.
3. Consider restricting ALB ingress to Cloudflare IP ranges (comment already in `modules/alb/main.tf`).

**Trigger:** Before any environment is reachable from outside a personal test context.

### CloudFront for video delivery

CloudFront is disabled in staging (`enable_cloudfront = false`) because personal AWS accounts require Support verification before CloudFront can be used. The module is fully implemented and gated behind the variable. When moving to the work account:

1. Remove `enable_cloudfront = false` from `environments/staging/s3/terragrunt.hcl` (production defaults to `true`).
2. Consider adding a custom domain + ACM cert to the CloudFront distribution at the same time as the TLS work above.

**Trigger:** Before video delivery needs to work end-to-end in staging.

---

## Deferred Re-evaluations

### R2 vs S3 + CloudFront for video storage

D-014 lands on S3 + CloudFront OAC. R2 is deferred, not rejected.

**Re-evaluate when:** S3 egress costs exceed ~$5K/month at video scale. At 100K clips/day × 50MB, egress from S3 is the dominant cost variable; R2's zero-egress pricing is material.

**Blocker before R2 can be adopted:** Confirm R2's S3-compatible event notifications work for the transcoding pipeline, and that the clip storage migration from `outplayed.tv/media` can land on R2 directly.

### RDS PostgreSQL vs Aurora Global Database

D-007 lands on RDS. Aurora is the named migration path, not a future unknown.

**Re-evaluate when any of:**
- EU users exceed 20% of traffic
- An EU latency SLA is required
- An incident where >1 min Multi-AZ failover causes measurable business impact

**Trade-off summary:** Aurora Global Database gives ~1 min managed cross-region failover vs ~30 min manual for RDS. Costs ~$50–60/mo more at current scale. Migration from RDS to Aurora is straightforward (snapshot restore, minimal downtime) — no penalty for deferring.

### Statsig vs self-built experimentation

D-003 locks Statsig Warehouse Native. Re-evaluate at contract renewal if:
- Statsig's MAU pricing exceeds what a lightweight in-house solution would cost to operate
- Warehouse Native tier stops supporting Snowflake

---

## Product Questions (Require Business Input)

### Social graph model

Twitter-style (follow anyone, asymmetric) or Facebook-style (mutual friendship required)?

Affects: `follows` table schema, feed query, notification design, moderation surface. Needs product decision before the Follows feature ships.

### Content policy

What categories of content require moderation action? Affects tooling requirements, report queue design, and operational staffing for the moderation admin panel.

### Geographic priority

Are specific regions (EU, Asia) higher priority for low-latency experience? Affects infrastructure placement, CDN configuration, and the Aurora migration trigger above.

### Monetization timeline

If premium features or creator monetization are planned, architecture changes (entitlements, billing webhooks, Tebex integration) may be needed before Phase 6. Current scope assumes no monetization infrastructure.

### Riot RSO credentials

RSO provider code is complete. Credentials are pending vendor approval. No code changes needed — set `RIOT_CLIENT_ID` and `RIOT_CLIENT_SECRET` when approved.

---

## Migration Blockers (Post-Handoff)

Three unknowns gate the existing-user migration plan. Tracked in [decisions.md §Migration Blockers](decisions.md#migration-blockers-informational-not-decisions) and [platform-strategy.md](platform-strategy.md#migration-blockers).

1. Can Overwolf provide a filtered export of Outplayed users?
2. Does the Overwolf SDK expose hooks for overriding the auth flow from the client side?
3. Who owns `uploads.outplayed.tv/media` and can the user→clip mapping be reconstructed?
