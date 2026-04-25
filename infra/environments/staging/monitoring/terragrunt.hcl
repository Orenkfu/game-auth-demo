include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("env.hcl") }

terraform { source = "../../../modules/monitoring" }

# Overrides the root-generated versions.tf to add the Datadog provider alongside aws+random.
generate "versions_override" {
  path      = "versions.tf"
  if_exists = "overwrite"
  contents  = <<EOF
terraform {
  required_version = ">= 1.6.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
  }
}
EOF
}

generate "datadog_provider" {
  path      = "datadog_provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "datadog" {
  # Reads DD_API_KEY and DD_APP_KEY from environment automatically
}
EOF
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

inputs = {
  project     = local.env.locals.project
  environment = "staging"
  dd_api_key  = get_env("DD_API_KEY")
}
