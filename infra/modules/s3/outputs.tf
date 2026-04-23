output "bucket_name"            { value = aws_s3_bucket.videos.id }
output "bucket_arn"             { value = aws_s3_bucket.videos.arn }
output "cloudfront_domain_name" { value = aws_cloudfront_distribution.videos.domain_name }
output "cloudfront_arn"         { value = aws_cloudfront_distribution.videos.arn }
