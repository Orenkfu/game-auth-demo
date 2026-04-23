variable "project"     { type = string }
variable "environment" { type = string }
variable "vpc_cidr"    { type = string; default = "10.0.0.0/16" }
variable "az_count"    { type = number; default = 2 }

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "Use a single NAT gateway (cost saving for staging)"
}
