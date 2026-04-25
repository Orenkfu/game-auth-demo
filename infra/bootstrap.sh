#!/usr/bin/env bash
# One-time setup: creates the S3 bucket and DynamoDB table that Terragrunt
# needs before it can store remote state. Safe to re-run — skips existing resources.
set -euo pipefail

PROJECT="outplayed"
REGION="us-east-1"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="${PROJECT}-terraform-state-${ACCOUNT_ID}"
TABLE="${PROJECT}-terraform-locks"

echo "Account : ${ACCOUNT_ID}"
echo "Bucket  : ${BUCKET}"
echo "Table   : ${TABLE}"
echo "Region  : ${REGION}"
echo ""

# --- S3 bucket ---

if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "[skip] S3 bucket already exists: ${BUCKET}"
else
  echo "[create] S3 bucket: ${BUCKET}"
  # us-east-1 must omit LocationConstraint (AWS quirk)
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}"
fi

echo "[ensure] S3 versioning enabled"
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

echo "[ensure] S3 encryption enabled"
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"},
      "BucketKeyEnabled": true
    }]
  }'

echo "[ensure] S3 public access blocked"
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# --- DynamoDB lock table ---

if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" 2>/dev/null; then
  echo "[skip] DynamoDB table already exists: ${TABLE}"
else
  echo "[create] DynamoDB table: ${TABLE}"
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}"

  echo "[wait] for table to become active..."
  aws dynamodb wait table-exists --table-name "${TABLE}" --region "${REGION}"
fi

echo ""
echo "Bootstrap complete. You can now run terragrunt commands."
