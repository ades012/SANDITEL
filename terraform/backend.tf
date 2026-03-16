terraform {
  backend "s3" {
    bucket         = "ades012-sanditel-tfstate"
    key            = "sanditel/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}