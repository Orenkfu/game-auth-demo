locals {
  environment = "staging"
  project     = "outplayed"
  aws_region  = "us-east-1"
}

inputs = {
  project     = local.project
  environment = local.environment
  aws_region  = local.aws_region
}
