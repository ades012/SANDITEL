output "eks_cluster_name" {
  description = "EKS Cluster Name"
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS Cluster Endpoint"
  value = module.eks.cluster_endpoint
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC Provider ARN"
  value = module.eks.oidc_provider_arn
}

output "ecr_backend_url" {
  description = "URL Registry push backend"
  value = module.ecr_backend-api.repository_url
}

output "ecr_frontend_url" {
  description = "URL Registry push frontend"
  value = module.ecr_frontend.repository_url
}

output "ecr_dude_url" {
  description = "URL Registry push frontend"
  value = module.ecr_dude_bot.repository_url
}

output "rds_endpoint" {
  description = "Endpoint database for backend"
  value = module.db.db_instance_endpoint
}

output "vpc_id" {
  description = "Main ID PVC"
  value = module.vpc.vpc_id
}