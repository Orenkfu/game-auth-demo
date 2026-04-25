# Operations Runbooks

Runbooks for common production incidents. Each section lists symptoms, a
diagnostic checklist, and the least-destructive remediation first.

Contact rotation, paging policy, and escalation paths live in the on-call
handbook — not here. This document assumes you are already on the incident.

---

## 1. Backend down / 5xx storm

**Symptoms.** ALB 5xx alarm, ECS task churn, `/api/v1/oauth/session`
returning 500/503, Datadog APM error rate spike.

**First 5 minutes.**
1. ECS service events: `aws ecs describe-services --cluster outplayed-<env> --services backend`. Look for `service unable to place a task` or repeated `task exited with non-zero status`.
2. Hit readiness directly through the ALB: `GET /health/ready`. Which indicator is `down`?
   - `postgres` → section 2.
   - `redis` → section 4.
   - Both → likely VPC / SG / IAM regression, not an app bug.
3. Liveness endpoint `GET /health/live` returning 200 but readiness failing means the app is up but a dependency is out — do **not** roll back the app, fix the dependency.

**Remediation.**
- Recent deploy? Roll back ECS service to the previous task definition revision. Task definitions are immutable — use `aws ecs update-service --task-definition <arn-of-previous>`.
- No deploy, dependency healthy? Force a fresh task: `aws ecs update-service --force-new-deployment`. Session state survives (Redis); Postgres connections re-establish via the retry loop in `PrismaService.onModuleInit`.

**Post-incident.**
- Confirm error budget impact in Datadog.
- If the regression shipped via deploy, add a guardrail test before unblocking the next release.

---

## 2. Postgres disk full / write failures

**Symptoms.** `PrismaClientKnownRequestError` with code `53100` (disk full) or `P1017` (connection lost). RDS CloudWatch `FreeStorageSpace` alarm.

**Do not** run `VACUUM FULL` on a live primary — it takes an exclusive lock.

**Triage.**
1. Check RDS free storage. If `max_allocated_storage` is set (it is — see `infra/modules/rds/main.tf:42`), RDS auto-grows. If auto-grow is failing, there is a service limit or the cap has been hit.
2. Identify the offending table:
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables
   ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;
   ```
3. Check dead tuples: `SELECT relname, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;`

**Remediation.**
- Raise `max_allocated_storage` in the RDS module and apply.
- If dead tuples are the driver, run `VACUUM (VERBOSE, ANALYZE) <table>;` — concurrent-safe, reclaims to the free list but not the OS.
- If a specific table is runaway (audit logs, event staging), truncate or partition-rotate before growing hardware.

**Prevention.**
- `FreeStorageSpace < 20%` alarm → page.
- `DatabaseConnections > 80%` of max_connections → page (connection leaks show up here first).

---

## 3. Redis eviction / session loss

**Symptoms.** Users report random logouts. `GET /api/v1/oauth/session` returns 401 for valid-looking cookies. ElastiCache `Evictions` metric non-zero.

**Triage.**
1. ElastiCache metric: `DatabaseMemoryUsagePercentage`. > 75% is the danger zone.
2. Eviction policy: session keys use `SETEX` with TTL — they should expire before eviction. If evictions are happening under the TTL, the instance is undersized.
3. Key count and sampling:
   ```bash
   redis-cli INFO keyspace
   redis-cli --scan --pattern 'session:*' | head -20
   redis-cli MEMORY USAGE session:<sample-key>
   ```

**Remediation.**
- Flush stale keys only if you know the prefix and impact. `FLUSHDB` on the session store will log every user out.
- Scale the node class: update `infra/modules/redis/` and apply. ElastiCache resizing is online for primary/replica setups.

**Known non-issue.** Sliding-window session refresh on every request is by design — do **not** cache the session TTL in the app layer. See [decisions.md](decisions.md) D-006.

---

## 4. OAuth provider outage (Discord / Riot)

**Symptoms.** New logins fail with `ERROR_DISCORD_CODE_EXCHANGE` or `ERROR_RIOT_CODE_EXCHANGE`. Existing sessions continue to work — the outage only affects the OAuth code-exchange step.

**Triage.**
1. Check provider status: `https://discordstatus.com`, Riot developer portal status.
2. Backend logs: filter for `ERROR_DISCORD_*` / `ERROR_RIOT_*`. If requests to the provider time out (not 4xx), it is the provider.
3. 4xx from the provider after a deploy? The OAuth redirect URI or client secret may have been rotated — compare ECS env secrets vs. the provider app config.

**Remediation.**
- Provider outage: nothing to do but wait. Post a status banner on the frontend. Existing sessions remain valid; rule-1 logins (refresh tokens) will fail until the provider recovers.
- Secret/URI mismatch: rotate via AWS Secrets Manager → redeploy ECS task (secrets are pulled at task start, not reloaded live).

**Do not** rotate `OAUTH_TOKEN_ENCRYPTION_KEY` during a provider outage. Doing so would invalidate every stored access/refresh token at once. See [decisions.md](decisions.md) D-019.

---

## 5. OAuth state / PKCE recovery

**Symptoms.** Callback returns `ERROR_INVALID_OAUTH_STATE` or `ERROR_OAUTH_STATE_EXPIRED` for many users simultaneously.

**Triage.**
1. OAuth state is stored in Redis with a short TTL. Mass failures after a Redis failover or flush mean the state was lost between the redirect and the callback.
2. Check Redis `session:oauth_state:*` keys. If the namespace is empty during a live flow, something wiped it.

**Remediation.**
- Users can retry — the flow is idempotent.
- If Redis has failed over, wait for the replica to promote and retry.
- If a deploy flushed the cache, nothing to do operationally — state TTL is short by design.

---

## 6. Token encryption key incident

**Symptoms.** One of:
- Decryption failing (`invalid authentication tag`) across the board → key rotated without migration.
- Key suspected leaked.

**If the key was rotated by accident.**
- Roll back `OAUTH_TOKEN_ENCRYPTION_KEY` in Secrets Manager to the previous value and redeploy. Stored ciphertexts will decrypt again.

**If the key was leaked.**
- Rotate the key in Secrets Manager.
- Redeploy ECS — stored tokens cannot be decrypted with the new key. This is acceptable: rule-1 refresh-token flow retrieves a fresh provider token on next login and `updateTokens()` rewrites the ciphertext with the new key. See [decisions.md](decisions.md) D-019.
- Invalidate all sessions (flush Redis session namespace) to force re-auth.

---

## 7. Deploy rollback

**Backend (ECS).**
```bash
# List revisions
aws ecs list-task-definitions --family-prefix outplayed-backend --sort DESC --max-items 5

# Point the service at a known-good revision
aws ecs update-service \
  --cluster outplayed-<env> \
  --service backend \
  --task-definition outplayed-backend:<revision>
```

**Infra (Terragrunt).**
- `git revert` the commit that introduced the regression; re-apply.
- `terragrunt state rollback` is not a thing — state history lives in S3 versioning. If state is corrupt, restore a previous object version from the state bucket.

---

## Appendix: observability quick links

Fill these in once Datadog dashboards are set up (see [decisions.md](decisions.md) D-004).

- APM service: `outplayed-backend`
- Dashboards: (TBD)
- Log index: (TBD)
- Alarms: (TBD)
