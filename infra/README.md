# Outplayed Infrastructure

Terraform + Terragrunt. Two environments: `staging`, `production`.

## Prerequisites

- Terraform >= 1.6
- Terragrunt >= 0.55
- AWS CLI configured with appropriate credentials
- AWS account ID handy

## Bootstrap (first time only)

State is stored in S3. Create the state bucket and DynamoDB lock table before running
any Terragrunt commands:

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export PROJECT=outplayed

# State bucket
aws s3api create-bucket \
  --bucket ${PROJECT}-terraform-state-${AWS_ACCOUNT_ID} \
  --region ${AWS_REGION}

aws s3api put-bucket-versioning \
  --bucket ${PROJECT}-terraform-state-${AWS_ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket ${PROJECT}-terraform-state-${AWS_ACCOUNT_ID} \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# DynamoDB lock table
aws dynamodb create-table \
  --table-name ${PROJECT}-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${AWS_REGION}
```

Then update the `certificate_arn` placeholders in:
- `environments/staging/alb/terragrunt.hcl`
- `environments/production/alb/terragrunt.hcl`

## Deployment order

Modules have dependencies — deploy in this order the first time:

```bash
cd environments/staging   # or production

terragrunt run-all apply --terragrunt-modules-that-include vpc
terragrunt apply --terragrunt-working-dir iam
terragrunt apply --terragrunt-working-dir ecr
terragrunt apply --terragrunt-working-dir alb
terragrunt apply --terragrunt-working-dir s3
terragrunt apply --terragrunt-working-dir rds    # requires TF_VAR_db_password
terragrunt apply --terragrunt-working-dir redis
terragrunt apply --terragrunt-working-dir ecs
```

For subsequent changes, Terragrunt handles dependency resolution automatically:

```bash
terragrunt run-all apply
```

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

## Secrets

All application secrets live in AWS Secrets Manager under:
- `outplayed/staging/*`
- `outplayed/production/*`

ECS tasks pull secrets at startup via the `secrets` block in the task definition.
Never put secrets in environment variables or Terraform state.

Required secrets per environment:
- `database-url`
- `redis-url`
- `discord-client-id`
- `discord-client-secret`
- `riot-client-id`
- `riot-client-secret`
- `oauth-token-encryption-key`

AWS permissions (S3, CloudFront) are handled via the ECS task IAM role — no static credentials needed.
