variable "project"                 { type = string }
variable "environment"             { type = string }
variable "aws_region"              { type = string }
variable "vpc_id"                  { type = string }
variable "private_subnet_ids"      { type = list(string) }
variable "alb_security_group_id"   { type = string }
variable "target_group_arn"        { type = string }
variable "ecr_repository_url"      { type = string }
variable "task_execution_role_arn" { type = string }
variable "task_role_arn"           { type = string }
variable "secrets_arn_prefix"      { type = string; description = "Secrets Manager ARN prefix e.g. arn:aws:secretsmanager:us-east-1:123:secret:outplayed/staging" }
variable "image_tag"               { type = string; default = "latest" }
variable "container_port"          { type = number; default = 3001 }
variable "task_cpu"                { type = number; default = 512 }
variable "task_memory"             { type = number; default = 1024 }
variable "min_capacity"            { type = number; default = 1 }
variable "max_capacity"            { type = number; default = 4 }
