variable "project"     { type = string }
variable "environment" { type = string }
variable "dd_api_key" {
  type        = string
  sensitive   = true
  description = "Datadog API key - set via DD_API_KEY env var"
}
variable "dd_site" {
  type    = string
  default = "datadoghq.com"
}
