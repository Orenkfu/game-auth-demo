include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("terragrunt.hcl") }

terraform { source = "../../../modules/alb" }

dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id            = "vpc-mock"
    public_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
}

inputs = {
  vpc_id            = dependency.vpc.outputs.vpc_id
  public_subnet_ids = dependency.vpc.outputs.public_subnet_ids
  certificate_arn   = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/STAGING_CERT_ID"
}
