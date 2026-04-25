output "datadog_integration_role_arn" {
  value       = aws_iam_role.datadog.arn
  description = "ARN of the IAM role Datadog assumes for AWS integration"
}

output "datadog_log_forwarder_arn" {
  value       = module.datadog_log_forwarder.datadog_forwarder_arn
  description = "ARN of the Datadog log forwarder Lambda"
}
