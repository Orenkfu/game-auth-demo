data "aws_caller_identity" "current" {}

# Generated once and stored in state — breaks the cycle between the trust
# policy and the Datadog integration resource (each references the other).
resource "random_id" "datadog_external_id" {
  byte_length = 16
}

# ── Datadog assume-role trust policy ─────────────────────────────────────────

data "aws_iam_policy_document" "datadog_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::464622532012:root"]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [random_id.datadog_external_id.hex]
    }
  }
}

# ── Datadog-required IAM permissions (chunked to stay under 6144-byte limit) ─

data "datadog_integration_aws_iam_permissions" "main" {}

locals {
  permissions       = data.datadog_integration_aws_iam_permissions.main.iam_permissions
  target_chunk_size = 5900

  permission_sizes = [for p in local.permissions : length(p) + 3]
  cumulative_sizes = [for i in range(length(local.permission_sizes)) : sum(slice(local.permission_sizes, 0, i + 1))]
  chunk_assignments = [for s in local.cumulative_sizes : floor(s / local.target_chunk_size)]
  chunk_numbers     = distinct(local.chunk_assignments)
  permission_chunks = [
    for n in local.chunk_numbers : [
      for i, p in local.permissions : p if local.chunk_assignments[i] == n
    ]
  ]
}

data "aws_iam_policy_document" "datadog_permissions" {
  count = length(local.permission_chunks)
  statement {
    actions   = local.permission_chunks[count.index]
    resources = ["*"]
  }
}

# ── IAM role + policies ───────────────────────────────────────────────────────

resource "aws_iam_role" "datadog" {
  name               = "DatadogIntegrationRole-${var.environment}"
  description        = "Datadog AWS integration - read-only access"
  assume_role_policy = data.aws_iam_policy_document.datadog_assume_role.json
  tags               = { Name = "DatadogIntegrationRole-${var.environment}" }
}

resource "aws_iam_policy" "datadog" {
  count  = length(local.permission_chunks)
  name   = "DatadogAWSIntegrationPolicy-${var.environment}-${count.index + 1}"
  policy = data.aws_iam_policy_document.datadog_permissions[count.index].json
}

resource "aws_iam_role_policy_attachment" "datadog" {
  count      = length(local.permission_chunks)
  role       = aws_iam_role.datadog.name
  policy_arn = aws_iam_policy.datadog[count.index].arn
}

resource "aws_iam_role_policy_attachment" "datadog_security_audit" {
  role       = aws_iam_role.datadog.name
  policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}

# ── Datadog ↔ AWS account link ────────────────────────────────────────────────

resource "datadog_integration_aws_account" "main" {
  account_tags   = ["env:${var.environment}", "project:${var.project}"]
  aws_account_id = data.aws_caller_identity.current.account_id
  aws_partition  = "aws"

  aws_regions { include_all = true }

  auth_config {
    aws_auth_config_role {
      role_name   = aws_iam_role.datadog.name
      external_id = random_id.datadog_external_id.hex
    }
  }

  resources_config {
    cloud_security_posture_management_collection = true
    extended_collection                          = true
  }

  traces_config {
    xray_services {}
  }

  logs_config {
    lambda_forwarder {
      lambdas = [module.datadog_log_forwarder.datadog_forwarder_arn]
      sources = ["s3", "elbv2", "elb", "cloudfront", "rds", "ecs", "lambda", "vpc", "waf"]
      log_source_config {}
    }
  }

  metrics_config {
    namespace_filters {}
  }
}

# ── Log forwarder Lambda ──────────────────────────────────────────────────────

module "datadog_log_forwarder" {
  source  = "DataDog/log-lambda-forwarder-datadog/aws"
  version = "~> 1.0"

  dd_api_key = var.dd_api_key
  dd_site    = var.dd_site

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
