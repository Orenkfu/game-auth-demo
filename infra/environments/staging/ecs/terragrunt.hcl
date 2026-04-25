include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("env.hcl") }

terraform { source = "../../../modules/ecs" }

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id             = "vpc-mock"
    private_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
}

dependency "alb" {
  config_path = "../alb"
  mock_outputs = {
    target_group_arn      = "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/mock/0000000000000000"
    alb_security_group_id = "sg-mock"
  }
}

dependency "iam" {
  config_path = "../iam"
  mock_outputs = {
    ecs_task_execution_role_arn = "arn:aws:iam::000000000000:role/mock-execution"
    ecs_task_role_arn           = "arn:aws:iam::000000000000:role/mock-task"
  }
}

dependency "ecr" {
  config_path = "../ecr"
  mock_outputs = { repository_url = "mock.dkr.ecr.us-east-1.amazonaws.com/outplayed-backend" }
}

dependency "secrets" {
  config_path = "../secrets"
  mock_outputs = {
    secrets_arn_prefix = "arn:aws:secretsmanager:eu-west-1:000000000000:secret:outplayed/staging"
  }
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

inputs = {
  aws_region              = local.env.locals.aws_region
  vpc_id                  = dependency.vpc.outputs.vpc_id
  private_subnet_ids      = dependency.vpc.outputs.private_subnet_ids
  alb_security_group_id   = dependency.alb.outputs.alb_security_group_id
  target_group_arn        = dependency.alb.outputs.target_group_arn
  task_execution_role_arn = dependency.iam.outputs.ecs_task_execution_role_arn
  task_role_arn           = dependency.iam.outputs.ecs_task_role_arn
  ecr_repository_url      = dependency.ecr.outputs.repository_url
  secrets_arn_prefix      = dependency.secrets.outputs.secrets_arn_prefix

  task_cpu     = 256
  task_memory  = 512
  min_capacity = 1
  max_capacity = 3
}
