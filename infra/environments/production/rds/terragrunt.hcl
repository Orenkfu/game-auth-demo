include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("env.hcl") }

terraform { source = "../../../modules/rds" }

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id             = "vpc-mock"
    private_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
}

dependency "ecs" {
  config_path = "../ecs"
  mock_outputs = { ecs_security_group_id = "sg-mock" }
}

inputs = {
  vpc_id                = dependency.vpc.outputs.vpc_id
  private_subnet_ids    = dependency.vpc.outputs.private_subnet_ids
  ecs_security_group_id = dependency.ecs.outputs.ecs_security_group_id
  instance_class        = "db.t4g.medium"
  allocated_storage     = 50
  multi_az              = true
  max_allocated_storage = 200
  db_password           = get_env("TF_VAR_db_password")
}
