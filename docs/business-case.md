# Outplayed Backend — Business Case

**Purpose:** Backend infrastructure to transform Outplayed from a clip capture tool into a social gaming platform — decoupled from Overwolf's shared platform infrastructure.

**Current user base:** 9 million users (existing Outplayed install base)

---

## Current Scale Baseline

Outplayed already has significant scale. Cost and capacity planning must account for this existing user base, not a greenfield startup.

| Metric | Estimate | Basis |
|--------|----------|-------|
| Registered users | 9 million | Current Outplayed install base |
| Daily active users (DAU) | 900K–1.3M | 10–15% of install base (typical for gaming tools) |
| Events/day (Phase 2+) | 20–30 million | ~25 events per session × DAU |
| Clips captured/day | 90K–150K | ~10% of DAU captures at least one clip |
| Clip views/day (Phase 4+) | 2–10 million | Social discovery drives view multiplier on clips |
| Likes/day (Phase 4+) | 200K–1M | ~10% view-to-like conversion |

*These projections assume current user base. Growth from social features would increase all metrics.*

---

## What We're Building

Outplayed adds social features to the existing clip capture experience: user profiles, feeds, likes, follows, leaderboards, comments, and content discovery.

| Capability | Business Value |
|------------|----------------|
| **Social engagement** (likes, follows, comments) | Increases retention and daily active usage |
| **Personalized feeds** | Keeps users in-app longer; drives clip discovery |
| **Game-specific leaderboards** | Creates competitive motivation; surfaces top content |
| **A/B testing infrastructure** | Enables data-driven product decisions from day one |
| **Content moderation** | Protects brand and community; required for any public platform |
| **Analytics pipeline** | Provides visibility into user behavior, feature adoption, content performance |

---

## Timeline and Milestones

| Phase | Milestone | Cumulative Time |
|-------|-----------|-----------------|
| **Instrumentation** | Event tracking live in desktop client | Month 1 |
| **Data pipeline** | Analytics dashboards operational | Month 6 |
| **Experimentation** | A/B testing capability live | Month 7.5 |
| **Core social** | Profiles, clips, likes, follows, feeds | Month 14.5 |
| **Community features** | Comments, reporting, moderation tools | Month 17.5 |
| **Discovery** | Search and content recommendations | Month 19.5 |
| **Video optimization** | Transcoding pipeline (if needed) | Month 21.5 |

---

## Infrastructure Costs (Estimated Monthly Run Rate)

Costs below are based on **9M users / 1M DAU / 25M events per day** throughput. All estimates cover three cloud environments: Dev + Staging + Production.

### By Phase (All Cloud Environments Combined)

| Phase | Production | Dev (~15%) | Staging (~25%) | Total/Month | Key Cost Drivers |
|-------|------------|------------|----------------|-------------|------------------|
| **Phase 0–1** | $800–1,500 | $120–225 | $200–375 | **$1,100–2,100** | PostgreSQL, Redis, minimal compute |
| **Phase 2–3** | $4,000–7,000 | $600–1,050 | $1,000–1,750 | **$5,600–9,800** | Kafka (~$1.5K), Snowflake (existing), Statsig (~$1K MAU-based) |
| **Phase 4–5** | $8,000–15,000 | $1,200–2,250 | $2,000–3,750 | **$11,200–21,000** | Database scaling, CDN, video storage (~$3K), compute workers |
| **Phase 6–7** | $12,000–22,000 | $1,800–3,300 | $3,000–5,500 | **$16,800–30,800** | Search service (~$2K), transcoding compute (~$3K), storage growth |

### Cost Breakdown by Service (Phase 4+ steady state)

| Service | Estimated Monthly | Notes |
|---------|-------------------|-------|
| **PostgreSQL** (managed) | $800–2,000 | Scales with connections and storage |
| **Kafka** (managed) | $1,200–2,500 | 25M events/day × 14-day retention × 2 topics |
| **Snowflake** | Existing infrastructure | Leverages existing analytics pipeline |
| **Redis** | $200–500 | Dedup keys, rate limiting |
| **S3 + CloudFront** | $500–2,500 | Clips + thumbnails; CDN + egress |
| **Compute** (API + workers) | $1,500–4,000 | Scales with traffic |
| **Statsig** | $500–1,500 | MAU-based pricing; Warehouse Native tier |
| **Search** (Phase 6+) | $500–2,000 | Typesense Cloud or Algolia |
| **Observability** (Datadog) | $300–800 | Scales with log volume |
| **Transcoding** (Phase 7) | $1,000–3,000 | FFmpeg workers; scales with clip volume |

### Environment Strategy

| Environment | Purpose | Cost Model |
|-------------|---------|------------|
| **Local** | Unit tests, rapid iteration | Docker Compose — $0 cloud cost |
| **Dev** (cloud) | Integration testing, QA, client/backend decoupling | ~15–20% of prod |
| **Staging** (cloud) | Pre-prod validation, release candidate testing | ~25% of prod |
| **Production** (cloud) | Live users | Full scale, auto-scaling enabled |

Staging should receive sampled production event traffic (1–5%) to catch pipeline issues before they hit prod.

### Video Storage: The Scalability Risk

Video is the largest cost variable. At 100K clips/day averaging 50MB each:
- **Raw storage:** 5TB/day = 150TB/month
- **With 90-day retention:** 450TB at current S3 pricing ≈ $10K/month
- **Egress** is a material variable — revisit R2 vs S3+CloudFront when clip volumes justify the migration effort. See [D-014](decisions.md#d-014--video-object-storage-s3--cloudfront-oac).

### Monthly Cloud Costs by Project Stage

| Stage | Months | Monthly Cost (Expected) | What's Running |
|-------|--------|-------------------------|----------------|
| **Early build** | 1–3 | $1,500/mo | PostgreSQL, Redis, minimal compute |
| **Data pipeline live** | 4–8 | $7,500/mo | + Kafka, Snowflake, Statsig, operational consumers |
| **Social features live** | 9–18 | $16,000/mo | + CDN, video storage, API scaling |
| **Full platform** | 19–22 | $24,000/mo | + Search service, transcoding workers |

### Cumulative Infrastructure Investment (22 months)

| Scenario | Total Infrastructure Cost | Average Monthly |
|----------|---------------------------|-----------------|
| **Conservative** | ~$210,000 | ~$9,500/mo |
| **Expected** | ~$320,000 | ~$14,500/mo |
| **High growth** | ~$460,000 | ~$21,000/mo |

*Includes all 3 cloud environments. Excludes personnel, third-party software licenses, and Overwolf platform fees.*

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Auth migration blockers** | Delays social features for existing users | Resolve post-handoff; new-user flow unblocked (D-001) |
| **Content moderation volume** | Operational burden if reports spike | Moderation tools ship alongside comments; manual review first |
| **Feed performance at scale** | Degraded experience if follow counts grow large | Explicit scaling migration path in architecture; monitor and migrate when needed |
| **Video costs at scale** | Storage and delivery grow with success | Zero-egress R2 is the reconsideration trigger when S3 egress costs become material (D-014) |

---

## What Success Looks Like

**By Month 8 (end of experimentation phase):**
- Real-time dashboards showing DAU, clip capture rates, and session length
- A/B testing live with first experiments running

**By Month 15 (end of core social):**
- Users can follow creators, like clips, browse personalized feeds
- Game-specific leaderboards driving competitive engagement

**By Month 22 (full rollout):**
- Complete social platform with search, comments, and content discovery
- Scalable video pipeline handling growth

---

## Key Decisions

All architecture decisions with full rationale are in [decisions.md](decisions.md). Summary:

1. **Self-managed auth** (D-001) — own SLA, own velocity, no OW platform dependency
2. **AWS + managed services** (D-005) — engineering time goes to product, not infrastructure
3. **Snowflake warehouse** (D-002) — piggyback on existing infrastructure; avoid a second analytics stack
4. **Data-first approach** — instrumentation ships before social features; product decisions grounded in real data
5. **Progressive rollout** — each phase delivers usable functionality

---

## Open Questions Requiring Business Input

1. **Content policy** — What categories of content require moderation action? Affects tooling requirements and operational staffing.
2. **Geographic priority** — Are specific regions (EU, Asia) higher priority for low-latency experience? Affects infrastructure placement.
3. **Monetization timeline** — If premium features or creator monetization are planned, architecture changes may be needed earlier. Current scope assumes no monetization infrastructure.
4. **Mobile/web expansion** — Current scope is desktop-only. Mobile or web clients extend timeline and require additional frontend resources.

---

*Pricing estimates based on vendor documentation (April 2026). Infrastructure costs exclude personnel.*
