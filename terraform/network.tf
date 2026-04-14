module "vpc" {
    source  = "terraform-aws-modules/vpc/aws"
    version = "~> 5.0"
    
    name = "main-vpc"
    cidr = "10.0.0.0/16"

    azs             = ["${var.aws_region}a", "${var.aws_region}b"]
    private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
    public_subnets  = ["10.0.100.0/24", "10.0.100.0/24"]

    create_igw              = true
    map_public_ip_on_launch = true
    enable_nat_gateway      = true
    single_nat_gateway      = true

    tags = {
        "kubernetes.io/cluster/${var.project_name}-eks" = "shared"
    } 
  
}