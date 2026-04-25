include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("env.hcl") }

terraform { source = "../../../modules/ecr" }

# ECR is shared across environments — only deploy once
# If already deployed for production, skip this
