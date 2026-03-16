variable "aws_region" {
  default = "ap-southeast-1"
}
variable "project_name" {
  default = "sanditel"
}
variable "db_password" {
  description = "Password RDS Postgre"
  type        = string
  sensitive   = true
}
variable "environment" {
  default = "production"
}
variable "db_username" {
  description = "Username RDS Postgre"
  type = string
  sensitive = true
}
