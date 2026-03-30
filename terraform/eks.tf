module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "${var.project_name}-eks"
  cluster_version = "1.31"

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  # --- K8S BEST PRACTICES ---
  enable_irsa                              = true
  enable_cluster_creator_admin_permissions = true

  # node_security_group_additional_rules = {
  #   wireguard_outbound = {
  #     description      = "Allow WireGuard outbound to Office"
  #     protocol         = "udp"
  #     from_port        = 51820
  #     to_port          = 51820
  #     type             = "egress"
  #     cidr_blocks      = ["0.0.0.0/0"]
  #   }
  #   wireguard_inbound = {
  #     description      = "Allow WireGuard inbound for handshake"
  #     protocol         = "udp"
  #     from_port        = 51820
  #     to_port          = 51820
  #     type             = "ingress"
  #     cidr_blocks      = ["0.0.0.0/0"]
  #   }
  # }

  eks_managed_node_groups = {
    worker_nodes = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_types = ["t3.medium"]
      ami_type       = "AL2_x86_64"
    }
  }
}