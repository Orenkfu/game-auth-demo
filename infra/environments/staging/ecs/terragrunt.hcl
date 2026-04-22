include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("terragrunt.hcl") }

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
    target_group_arn      = "arn:aws:elasticloadbalancing:mock"
    alb_security_group_id = "sg-mock"
  }
}

dependency "iam" {
  config_path = "../iam"
  mock_outputs = {
    ecs_task_execution_role_arn = "arn:aws:iam::mock:role/mock-execution"
    ecs_task_role_arn           = "arn:aws:iam::mock:role/mock-task"
  }
}

dependency "ecr" {
  config_path = "../ecr"
  mock_outputs = { repository_url = "mock.dkr.ecr.us-east-1.amazonaws.com/outplayed-backend" }
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("terragrunt.hcl"))
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
  secrets_arn_prefix      = "arn:aws:secretsmanager:us-east-1:${get_aws_account_id()}:secret:outplayed/staging"

  task_cpu     = 256
  task_memory  = 512
  min_capacity = 1
  max_capacity = 3
}
