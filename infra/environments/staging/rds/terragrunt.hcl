include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("terragrunt.hcl") }

terraform { source = "../../../modules/rds" }

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id               = "vpc-mock"
    private_subnet_ids   = ["subnet-mock-1", "subnet-mock-2"]
  }
}

dependency "ecs" {
  config_path = "../ecs"
  mock_outputs = { ecs_security_group_id = "sg-mock" }
}

inputs = {
  vpc_id               = dependency.vpc.outputs.vpc_id
  private_subnet_ids   = dependency.vpc.outputs.private_subnet_ids
  ecs_security_group_id = dependency.ecs.outputs.ecs_security_group_id
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  multi_az             = false
  db_password          = get_env("TF_VAR_db_password")
}
