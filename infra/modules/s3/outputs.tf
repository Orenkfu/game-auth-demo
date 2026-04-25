output "bucket_name"            { value = aws_s3_bucket.videos.id }
output "bucket_arn"             { value = aws_s3_bucket.videos.arn }
output "cloudfront_domain_name" { value = var.enable_cloudfront ? aws_cloudfront_distribution.videos[0].domain_name : null }
output "cloudfront_arn"         { value = var.enable_cloudfront ? aws_cloudfront_distribution.videos[0].arn : null }
