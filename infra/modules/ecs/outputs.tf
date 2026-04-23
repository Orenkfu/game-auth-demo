output "cluster_name"       { value = aws_ecs_cluster.main.name }
output "cluster_arn"        { value = aws_ecs_cluster.main.arn }
output "service_name"       { value = aws_ecs_service.main.name }
output "ecs_security_group_id" { value = aws_security_group.ecs.id }
