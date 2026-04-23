include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("terragrunt.hcl") }

terraform { source = "../../../modules/vpc" }

inputs = {
  az_count           = 3
  single_nat_gateway = false  # one NAT per AZ for HA
}
