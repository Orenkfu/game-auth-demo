output "secrets_arn_prefix" {
  description = "ARN prefix matching all secrets created by this module."
  value       = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.project}/${var.environment}"
}

output "secret_arns" {
  description = "Map of secret name to full ARN."
  value       = { for name, secret in aws_secretsmanager_secret.main : name => secret.arn }
}
