include "root" { path = find_in_parent_folders() }
include "env"  { path = find_in_parent_folders("env.hcl") }

terraform { source = "../../../modules/s3" }

inputs = {
  enable_cloudfront = false  # personal AWS account not verified for CloudFront
}
