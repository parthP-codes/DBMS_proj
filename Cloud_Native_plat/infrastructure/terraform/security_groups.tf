# 1. Public Application Load Balancer Security Group
resource "aws_security_group" "alb_sg" {
  name        = "omnicart-alb-sg"
  description = "Allows inbound HTTPS from internet/CloudFront to public ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow traffic to private application tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "omnicart-alb-sg" }
}

# 2. Private ECS Microservices Security Group
resource "aws_security_group" "ecs_sg" {
  name        = "omnicart-ecs-sg"
  description = "Allows inbound traffic only from the ALB to container tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Inbound from ALB on microservice port 8080"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "Outbound to database tier and NAT Gateway"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "omnicart-ecs-sg" }
}

# 3. Private Isolated Database Security Group
resource "aws_security_group" "db_sg" {
  name        = "omnicart-db-sg"
  description = "Allows inbound connections only from ECS tasks to Aurora and Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }

  ingress {
    description     = "Redis cache from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }

  egress {
    description = "No outbound allowed from DB tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = { Name = "omnicart-db-sg" }
}
