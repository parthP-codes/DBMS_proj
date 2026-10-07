# OmniCart 360: Complete AWS Deployment Guide
## Production & Academic Implementation Manual

This guide walks you through deploying the **OmniCart 360** Cloud-Native Platform onto AWS.

---

### 📋 Prerequisites & Environment Check

1. **Active AWS Account**: Ensure you have credentials configured (`aws configure`).
   - Your current account is configured with:
     - **Region**: `ap-south-1` (Mumbai)
     - **Account ID**: `404006608500`
2. **AWS CLI v2**: Verified installed (`aws --version`).
3. **Permissions**: Ensure your IAM user has permissions for VPC, EC2, ECS, S3, DynamoDB, SQS, SNS, Cognito, and CloudFormation.

---

## Method 1: Automated 1-Click CloudFormation Deployment (Recommended)

The easiest, cleanest, and most reliable way to deploy the entire multi-tier architecture without installing Terraform or Docker is using the provided **CloudFormation Template**.

### Step 1: Deploy Core Cloud-Native Infrastructure
Open PowerShell in your project directory (`d:\College docs\AWS\Cloud_Native_plat`) and run:

```powershell
aws cloudformation deploy `
  --template-file infrastructure/cloudformation/omnicart_platform.yaml `
  --stack-name omnicart-prod `
  --capabilities CAPABILITY_NAMED_IAM `
  --region ap-south-1
```

*This will automatically provision:*
- **Multi-AZ VPC** (`10.0.0.0/16`) across 2 Availability Zones
- **6 Subnets**: 2 Public, 2 Private App, 2 Private DB
- **Internet Gateway + Highly Available NAT Gateway**
- **Tiered Security Groups** (ALB $\rightarrow$ ECS $\rightarrow$ DB)
- **Amazon S3 Bucket** with KMS encryption and Intelligent-Tiering
- **Amazon DynamoDB Tables** (`omnicart-prod-carts` & `omnicart-prod-products`)
- **Amazon SQS Queues** with Dead Letter Queue (DLQ)
- **Amazon SNS Topic** for event fan-out
- **Amazon Cognito User Pool** and OIDC Client
- **Amazon ECS Fargate Cluster** (`omnicart-prod-cluster`)
- **Application Load Balancer (ALB)** with Target Groups and Health Checks

### Step 2: Retrieve the Deployed Endpoints
Once the stack deployment completes (usually 3–5 minutes), retrieve your live public endpoints:

```powershell
aws cloudformation describe-stacks `
  --stack-name omnicart-prod `
  --query "Stacks[0].Outputs" `
  --output table
```

You will see:
- `LoadBalancerDNS`: Your public entry point (e.g., `omnicart-prod-alb-12345.ap-south-1.elb.amazonaws.com`)
- `CognitoUserPoolId`: Your authentication pool ID
- `MediaBucketName`: Your private S3 media bucket

---

## Method 2: Deploying Microservice Containers to Amazon ECS Fargate

Once the infrastructure stack is active, deploy the containerized microservices:

### Step 1: Create Amazon ECR Repositories
```powershell
aws ecr create-repository --repository-name omnicart/catalog-service --region ap-south-1
aws ecr create-repository --repository-name omnicart/order-service --region ap-south-1
```

### Step 2: Log In to ECR via Docker
```powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 404006608500.dkr.ecr.ap-south-1.amazonaws.com
```

### Step 3: Build, Tag, and Push Container Images
```powershell
# 1. Build Catalog Microservice
docker build -t omnicart/catalog-service ./services/catalog-service
docker tag omnicart/catalog-service:latest 404006608500.dkr.ecr.ap-south-1.amazonaws.com/omnicart/catalog-service:latest
docker push 404006608500.dkr.ecr.ap-south-1.amazonaws.com/omnicart/catalog-service:latest

# 2. Build Order Microservice
docker build -t omnicart/order-service ./services/order-service
docker tag omnicart/order-service:latest 404006608500.dkr.ecr.ap-south-1.amazonaws.com/omnicart/order-service:latest
docker push 404006608500.dkr.ecr.ap-south-1.amazonaws.com/omnicart/order-service:latest
```

*(Note: If Docker is not installed locally on your Windows machine, you can run these 4 commands inside **AWS CloudShell** directly in your browser!)*

---

## Method 3: Deploying Serverless Functions (AWS Lambda & Step Functions)

### Deploy the Payment Processing Lambda
```powershell
# Zip the Lambda handler
Compress-Archive -Path ./services/payment-lambda/* -DestinationPath ./payment_lambda.zip

# Create the Lambda function in AWS
aws lambda create-function `
  --function-name omnicart-payment-processor `
  --runtime python3.11 `
  --role arn:aws:iam::404006608500:role/omnicart-prod-ecs-task-role `
  --handler handler.lambda_handler `
  --zip-file fileb://payment_lambda.zip `
  --region ap-south-1
```

---

## Method 4: Deploying Amazon CloudFront CDN & AWS WAF

To enable the edge tier:

1. **AWS WAF**: In the AWS Console $\rightarrow$ **AWS WAF** $\rightarrow$ Create WebACL:
   - Name: `omnicart-edge-waf`
   - Add Managed Rule: `AWSManagedRulesCommonRuleSet` (OWASP Top 10 protection)
   - Add Rate-Limit Rule: 2,000 requests / 5 minutes per IP.
2. **Amazon CloudFront**:
   - Create Distribution.
   - **Origin Domain**: Select the Application Load Balancer DNS generated in Step 1.
   - **Protocol**: HTTPS Only.
   - **AWS WAF**: Select `omnicart-edge-waf`.

---

## 🧪 Testing & Verifying the Deployment

1. **Test ALB Health Check**:
   ```powershell
   curl http://<Your-LoadBalancer-DNS>/health
   ```
   *Expected Response:* `{"status": "HEALTHY", "service": "catalog-service"}`

2. **Verify DynamoDB Table Status**:
   ```powershell
   aws dynamodb list-tables --region ap-south-1
   ```

3. **Verify SQS Queue Messages**:
   ```powershell
   aws sqs get-queue-attributes `
     --queue-url https://sqs.ap-south-1.amazonaws.com/404006608500/omnicart-prod-order-fulfillment `
     --attribute-names All
   ```

4. **Verify CloudWatch Container Insights**:
   Navigate to AWS Console $\rightarrow$ CloudWatch $\rightarrow$ Container Insights $\rightarrow$ Select `omnicart-prod-cluster`.

---

## 💰 Safe Teardown & Cost Clean-Up (Crucial!)

To avoid unexpected charges after testing or presenting your college project, run:

```powershell
aws cloudformation delete-stack --stack-name omnicart-prod --region ap-south-1
```

This single command will cleanly delete all provisioned VPCs, NAT Gateways, ALBs, SQS queues, and DynamoDB tables.
