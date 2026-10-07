# OmniCart 360: Cloud-Native Enterprise Commerce & Fulfillment Platform
## Production-Grade Cloud Architecture Specification on Amazon Web Services (AWS)

[![AWS Architecture](https://img.shields.io/badge/AWS-Cloud--Native-FF9900?logo=amazon-aws)](https://aws.amazon.com/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform)](https://www.terraform.io/)
[![Docker & Fargate](https://img.shields.io/badge/Compute-ECS%20Fargate-232F3E?logo=docker)](https://aws.amazon.com/fargate/)
[![Aurora Multi-AZ](https://img.shields.io/badge/Database-Aurora%20PostgreSQL-527FFF?logo=postgresql)](https://aws.amazon.com/rds/aurora/)

---

### 📌 Project Summary
**OmniCart 360** is an enterprise-grade, multi-tenant cloud-native retail commerce and order fulfillment platform architected on Amazon Web Services (AWS). It is designed to handle high-concurrency retail workloads, flash sales, and distributed logistics operations with zero single points of failure (SPOF).

The full academic design specification containing all 23 structured sections is located in:
👉 **[Cloud_Native_Platform_AWS_Design.md](./Cloud_Native_Platform_AWS_Design.md)**

A visual, browser-friendly interactive presentation with live Mermaid diagram rendering is available in:
👉 **[index.html](./index.html)** *(Double-click to open in any web browser)*

---

### 📂 Repository Structure

```text
OmniCart-360/
├── Cloud_Native_Platform_AWS_Design.md   # Complete 23-Section Academic Architecture Spec
├── README.md                             # Project README and Quick Start Guide
├── index.html                            # Standalone Interactive HTML Preview & PDF Exporter
├── docker-compose.yml                    # Local microservices emulation environment
│
├── infrastructure/                       # Infrastructure as Code (IaC)
│   └── terraform/
│       ├── main.tf                       # Provider configuration and backend state
│       ├── vpc.tf                        # Multi-AZ VPC (Public, App, DB Subnets, NAT GW)
│       ├── security_groups.tf            # Tiered Security Groups and egress/ingress rules
│       ├── ecs.tf                        # ECS Fargate Cluster, Task Definitions, ALB
│       ├── aurora.tf                     # Multi-AZ Aurora PostgreSQL cluster
│       ├── dynamodb.tf                   # NoSQL tables for Carts and Catalog
│       └── variables.tf                  # Environment variables & CIDR allocations
│
├── services/                             # Microservice Source Codes
│   ├── catalog-service/                  # Product Catalog Microservice (FastAPI/Node.js)
│   │   ├── app.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── order-service/                    # Order Orchestration & Saga Coordinator
│   │   ├── app.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── payment-lambda/                   # Serverless Payment Gateway Webhook Handler
│       ├── handler.py
│       └── requirements.txt
│
└── .vscode/                              # VS Code Workspace Configuration
    ├── extensions.json                   # Recommended extensions (Markdown, Mermaid, Terraform)
    └── settings.json                     # Workspace formatting and preview settings
```

---

### 🚀 Key Architectural Highlights

| Pillar | AWS Implementation |
| :--- | :--- |
| **Compute** | Amazon ECS with AWS Fargate (serverless container orchestration) + AWS Lambda (event-driven functions) |
| **Database** | Polyglot persistence: Amazon Aurora PostgreSQL (ACID orders) + Amazon DynamoDB (carts & sessions) + Amazon ElastiCache for Redis (in-memory caching) |
| **Storage** | Amazon S3 with S3 Intelligent-Tiering and Glacier Deep Archive lifecycle policies |
| **Networking** | Multi-AZ VPC across 2 Availability Zones with 3 subnet tiers (Public, App, DB), NAT Gateways, and AWS PrivateLink VPC Endpoints |
| **Security** | Zero-trust defense: AWS WAF, Amazon CloudFront, AWS KMS CMK encryption at rest, AWS Secrets Manager rotation, and Amazon Cognito OIDC |
| **Messaging** | Decoupled event-driven backbone using Amazon SQS (with DLQs), Amazon SNS, and Amazon EventBridge |
| **Disaster Recovery** | Cross-region Warm Standby (Primary: `us-east-1`, Secondary: `us-west-2`) achieving **RPO $\le 5$ min** and **RTO $\le 15$ min** |

---

### 💻 Quick Start: Opening the Project in VS Code

1. To open this project in VS Code from terminal:
   ```powershell
   code "d:\College docs\AWS\Cloud_Native_plat"
   ```
2. In VS Code, open [`Cloud_Native_Platform_AWS_Design.md`](./Cloud_Native_Platform_AWS_Design.md) and press `Ctrl + Shift + V` to view the full rendered specification.
3. Open [`index.html`](./index.html) in your browser for a printable presentation view.
