include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("terragrunt.hcl") }

terraform { source = "../../../modules/iam" }
