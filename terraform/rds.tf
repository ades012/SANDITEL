resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow DB traffic from EKS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${var.project_name}-db"

  engine               = "postgres"
  engine_version       = "14"
  family               = "postgres14" # DB parameter group
  major_engine_version = "14"         # DB option group
  instance_class       = "db.t3.micro" # Free-tier friendly

  allocated_storage     = 20
  max_allocated_storage = 100

  db_name  = "backend_db"
  username = var.db_username
  port     = 5432

  manage_master_user_password = false
  password                    = var.db_password

  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  subnet_ids = module.vpc.private_subnets

  create_db_subnet_group = true
  db_subnet_group_name   = "${var.project_name}-rds-subnet-group"

   # --- RDS BEST PRACTICES ---

  skip_final_snapshot = true
  deletion_protection = false

}