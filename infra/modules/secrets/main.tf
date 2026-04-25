data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  secret_names = [
    "database-url",
    "redis-url",
    "discord-client-id",
    "discord-client-secret",
    "riot-client-id",
    "riot-client-secret",
    "oauth-token-encryption-key",
  ]
}

resource "aws_secretsmanager_secret" "main" {
  for_each = toset(local.secret_names)

  name        = "${var.project}/${var.environment}/${each.value}"
  description = "${each.value} for ${var.project} ${var.environment}"

  recovery_window_in_days = var.environment == "production" ? 30 : 0
}

# Placeholder values so ECS can start. Real values are set out-of-band via
# `aws secretsmanager put-secret-value` (or rotation). `ignore_changes` keeps
# Terraform from clobbering rotated values on subsequent applies.
resource "aws_secretsmanager_secret_version" "placeholder" {
  for_each = aws_secretsmanager_secret.main

  secret_id     = each.value.id
  secret_string = "PLACEHOLDER-set-via-aws-cli"

  lifecycle {
    ignore_changes = [secret_string, version_stages]
  }
}
