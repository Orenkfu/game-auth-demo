variable "project"              { type = string }
variable "environment"          { type = string }
variable "vpc_id"               { type = string }
variable "private_subnet_ids"   { type = list(string) }
variable "ecs_security_group_id" { type = string }
variable "db_name"              { type = string; default = "outplayed" }
variable "db_username"          { type = string; default = "outplayed" }
variable "db_password"          { type = string; sensitive = true }
variable "instance_class"       { type = string; default = "db.t4g.medium" }
variable "allocated_storage"    { type = number; default = 20 }
variable "multi_az"             { type = bool; default = false }
variable "max_allocated_storage" { type = number; default = 0; description = "Upper limit for storage autoscaling (GB). 0 disables autoscaling." }
