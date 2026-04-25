# Outplayed Infrastructure

Terraform + Terragrunt. Two environments: `staging`, `production`.

## Prerequisites

- Terraform >= 1.6 (tested with 6.x AWS provider)
- Terragrunt >= 0.55 (uses the `run --all` CLI; the old `run-all` is removed)
- AWS CLI configured with credentials
- A Datadog account and API + APP keys

## One-time setup

**1. Bootstrap the state backend.** S3 state bucket + DynamoDB lock table live in `us-east-1`:

```bash
./bootstrap.sh
```

**2. Create `infra/.env`** (gitignored) with secrets read by Terragrunt at apply time:

```bash
DD_API_KEY=...        # from https://app.datadoghq.com/organization-settings/api-keys
DD_APP_KEY=...        # from https://app.datadoghq.com/organization-settings/application-keys
TF_VAR_db_password=... # RDS master password (any strong value)
```

Load it in your shell before running terragrunt:

```bash
export $(grep -v '^#' infra/.env | xargs)
```

## Deploy

Terragrunt resolves dependencies automatically — one command per environment:

```bash
cd infra/environments/staging   # or production
terragrunt run --all plan       # review
terragrunt run --all apply
```

The `secrets` unit creates AWS Secrets Manager entries with placeholder values so ECS
can start. Replace each placeholder with a real value out-of-band — Terraform won't
overwrite them on subsequent applies (`ignore_changes = [secret_string]`):

```bash
aws secretsmanager put-secret-value \
  --secret-id outplayed/staging/database-url \
  --secret-string "postgresql://..."
```

Required secrets (see `modules/secrets/main.tf`): `database-url`, `redis-url`,
`discord-client-id`, `discord-client-secret`, `riot-client-id`, `riot-client-secret`,
`oauth-token-encryption-key`.

## Environment differences

| Resource      | Staging              | Production            |
|---------------|----------------------|-----------------------|
| VPC AZs       | 2                    | 3                     |
| NAT Gateways  | 1 (shared)           | 1 per AZ              |
| ECS CPU/RAM   | 256 / 512            | 512 / 1024            |
| ECS min/max   | 1 / 3                | 2 / 10                |
| RDS class     | db.t4g.micro         | db.t4g.medium         |
| RDS Multi-AZ  | No                   | Yes                   |
| Redis         | cache.t4g.micro      | cache.t4g.medium      |
| Deletion protection | No             | Yes                   |

## Secrets at runtime

ECS tasks pull secrets at startup via the `secrets` block in the task definition; the
`task_execution_role` has `secretsmanager:GetSecretValue` scoped to
`outplayed/${environment}/*`. Never put secrets in environment variables or Terraform
state.

AWS permissions (S3, CloudFront) are handled via the ECS task IAM role — no static
credentials needed.

## Known tech debt

See [docs/open-questions.md](../docs/open-questions.md) — currently:
- ALB runs HTTP-only (no ACM cert wired up); HTTPS listener is gated behind
  `var.certificate_arn`.
- CloudFront is disabled in staging (`enable_cloudfront = false`) pending account
  verification on the personal AWS account used for early testing.
