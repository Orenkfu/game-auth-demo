# RDS PostgreSQL vs Aurora PostgreSQL

## Context

We currently use RDS PostgreSQL 16 in the infra scaffold. This document compares it against Aurora PostgreSQL for a future EU expansion decision — specifically the multi-region active-active scenario where both regions serve live traffic.

---

## What we're actually choosing between

| | RDS PostgreSQL | Aurora PostgreSQL |
|---|---|---|
| Engine compatibility | PostgreSQL 16 | PostgreSQL-compatible (minor differences) |
| Architecture | Single instance + standby | Distributed storage layer, separate from compute |
| Multi-AZ failover | ~1–2 min | ~30 sec (Aurora) or ~10 sec (Aurora Serverless v2) |
| Cross-region reads | Cross-region read replicas | Aurora Global Database |
| Cross-region write failover | Manual promotion (~30 min) | Managed promotion (~1 min) |
| Storage | Provisioned EBS volume | Auto-scales 10 GB → 128 TB, no provisioning |
| Max storage IOPS | Instance-bound | Decoupled from compute |

---

## Cost comparison (approximate, us-east-1)

### RDS PostgreSQL

| Component | Staging | Production |
|---|---|---|
| Instance (db.t4g.micro) | ~$13/mo | — |
| Instance (db.t4g.medium) | — | ~$52/mo |
| Multi-AZ (2x instance cost) | N/A | ~$104/mo |
| Storage (100 GB gp3) | ~$12/mo | ~$12/mo |
| **Estimated total** | **~$25/mo** | **~$116/mo** |

### Aurora PostgreSQL

| Component | Staging | Production |
|---|---|---|
| Instance (db.t4g.medium, minimum practical) | ~$65/mo | ~$65/mo |
| Multi-AZ (writer + reader) | — | ~$130/mo |
| Storage (per GB-month, auto-scaled) | ~$0.10/GB | ~$0.10/GB |
| I/O (per million requests) | ~$0.20 | ~$0.20 |
| **Estimated total** | **~$75–90/mo** | **~$145–180/mo** |

### Aurora Global Database (multi-region, production only)

Adds per-region replication costs on top of production Aurora:

| Component | Cost |
|---|---|
| Additional region instance (db.t4g.medium) | ~$65/mo |
| Global Database replication (per GB) | ~$0.20/GB |
| **Additional cost for EU region** | **~$70–100/mo** |

**Multi-region Aurora production estimate: ~$215–280/mo** vs RDS multi-region ~$200–250/mo (two separate stacks, no managed failover).

---

## Technical tradeoffs

### Where Aurora wins

- **Faster failover** — 30 sec vs 1–2 min for Multi-AZ; ~1 min managed promotion for cross-region vs ~30 min manual for RDS. Matters if you have SLA commitments.
- **Managed multi-region** — Aurora Global Database handles replication, monitoring, and failover as a single resource. RDS multi-region requires you to manage replication slots, promotion scripts, and DNS cutover yourself.
- **Storage headroom** — Auto-scales with no downtime. RDS storage can be increased but not decreased; requires planning.
- **Read scaling** — Up to 15 Aurora read replicas vs 5 for RDS. Relevant if query load grows significantly.

### Where RDS wins

- **Cost at our current scale** — Staging is 3x cheaper. Production is meaningfully cheaper until you need Global Database.
- **Simpler operations** — Standard PostgreSQL behavior, no Aurora-specific quirks. Easier to reproduce locally, easier to reason about.
- **No lock-in risk** — Aurora is PostgreSQL-*compatible*, not PostgreSQL. Edge cases exist around extensions, replication slot behavior, and vacuum tuning.
- **Sufficient failover for most cases** — 1–2 min Multi-AZ failover is acceptable for the majority of B2C gaming products.

---

## The actual decision point

The question isn't RDS vs Aurora in isolation — it's **when does the operational benefit justify the cost delta**.

| Scenario | Recommendation |
|---|---|
| Single region (US only), current scale | **RDS** — no meaningful benefit from Aurora |
| Single region, >100k DAU, high query load | **Aurora** — read replica scaling and storage headroom |
| Multi-region active-passive (EU standby) | **RDS** — manual failover is acceptable for a standby |
| Multi-region active-active (EU serves live traffic) | **Aurora Global Database** — managed replication and sub-minute failover are worth the premium |

---

## Recommendation

**Start with RDS. Plan a migration path to Aurora Global Database if/when EU active-active becomes a real requirement.**

Migration from RDS to Aurora is straightforward (AWS provides a snapshot restore path with minimal downtime), so there's no penalty for deferring. The cost delta (~$50–60/mo production) is not meaningful at early scale, but Aurora's operational complexity and compatibility surface area is real overhead to take on speculatively.

When EU expansion becomes a business decision, revisit this document. The trigger criteria:

- EU users represent >20% of traffic, or
- A latency SLA is required for EU, or
- An incident occurs where >1 min failover causes a measurable business impact
