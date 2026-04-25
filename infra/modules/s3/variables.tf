variable "project"     { type = string }
variable "environment" { type = string }

variable "enable_cloudfront" {
  type        = bool
  default     = true
  description = "Set false to skip CloudFront (required for unverified AWS accounts)"
}
