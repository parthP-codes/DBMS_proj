"""
OmniCart 360 - Live Demonstration & Validation Test Script
Tests the deployed AWS services and populates live data for presentation.
Compatible with standard Windows console encodings.
"""
import sys
import os

# Ensure UTF-8 output encoding on Windows terminals if supported
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import boto3
import json
import time
from decimal import Decimal

REGION = "us-east-1"

def print_step(title):
    print("\n" + "="*60)
    print(f"[*] {title}")
    print("="*60)

def test_aws_connectivity():
    print_step("Step 1: Testing AWS Identity & Credentials")
    sts = boto3.client('sts', region_name=REGION)
    identity = sts.get_caller_identity()
    print(f"[OK] Connected to AWS Account ID: {identity['Account']}")
    print(f"[OK] IAM User / Identity ARN:   {identity['Arn']}")
    return identity

def populate_dynamodb_products():
    print_step("Step 2: Populating Sample Products in DynamoDB")
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table_name = 'omnicart-prod-products'
    
    # Check if table exists
    client = boto3.client('dynamodb', region_name=REGION)
    try:
        table_desc = client.describe_table(TableName=table_name)
        status = table_desc['Table']['TableStatus']
        print(f"[OK] DynamoDB table '{table_name}' found (Status: {status})")
    except client.exceptions.ResourceNotFoundException:
        print(f"[WAIT] DynamoDB table '{table_name}' does not exist yet.")
        print("       Please deploy the CloudFormation stack 'omnicart-prod' first!")
        return False
    except Exception as e:
        print(f"[PERM ERROR] Could not describe DynamoDB table: {e}")
        return False

    table = dynamodb.Table(table_name)
    sample_products = [
        {
            "ProductId": "prod-101",
            "Category": "Electronics",
            "Name": "Wireless Noise-Canceling Headphones",
            "Price": Decimal("199.99"),
            "Stock": 50,
            "Status": "IN_STOCK"
        },
        {
            "ProductId": "prod-102",
            "Category": "Electronics",
            "Name": "Mechanical Ergonomic Keyboard",
            "Price": Decimal("129.50"),
            "Stock": 35,
            "Status": "IN_STOCK"
        },
        {
            "ProductId": "prod-103",
            "Category": "Displays",
            "Name": "4K Ultra-HD Smart Monitor 32-inch",
            "Price": Decimal("349.00"),
            "Stock": 15,
            "Status": "LOW_STOCK"
        }
    ]

    for item in sample_products:
        table.put_item(Item=item)
        print(f"   [+] Seeded Product: {item['ProductId']} - {item['Name']} (${item['Price']})")
    print("[OK] DynamoDB products successfully populated! Ready to view in AWS Console.")
    return True

def send_test_sqs_order():
    print_step("Step 3: Enqueueing Test Order into Amazon SQS")
    sqs = boto3.client('sqs', region_name=REGION)
    sts = boto3.client('sts', region_name=REGION)
    account_id = sts.get_caller_identity()['Account']
    queue_url = f"https://sqs.{REGION}.amazonaws.com/{account_id}/omnicart-prod-order-fulfillment"

    try:
        order_payload = {
            "order_id": f"ORD-{int(time.time())}",
            "customer_id": "cust-9081",
            "items": [
                {"product_id": "prod-101", "quantity": 1, "price": 199.99},
                {"product_id": "prod-102", "quantity": 2, "price": 129.50}
            ],
            "total_amount": 458.99,
            "payment_status": "PAID",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(order_payload)
        )
        print(f"   [+] Sent Order Message ID: {response['MessageId']}")
        print("[OK] SQS message enqueued! You will see active message counts in SQS Dashboard.")
        return True
    except sqs.exceptions.QueueDoesNotExist:
        print("[WAIT] SQS queue 'omnicart-prod-order-fulfillment' does not exist yet.")
        print("       Please deploy the CloudFormation stack 'omnicart-prod' first!")
        return False
    except Exception as e:
        print(f"[PERM ERROR] Could not send message to SQS: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("  OmniCart 360 - Live AWS Environment Verification Test")
    print("="*60)
    try:
        identity = test_aws_connectivity()
        p_ok = populate_dynamodb_products()
        s_ok = send_test_sqs_order()
        
        print("\n" + "="*60)
        if p_ok and s_ok:
            print("[SUCCESS] All AWS live data seeded successfully!")
            print("You can now open the AWS Console to show the results to your professor.")
        else:
            print("[NOTICE] Next step: Deploy the stack in AWS Console or attach IAM policies.")
        print("="*60)
    except Exception as err:
        print(f"\n[ERROR] Test encountered an issue: {err}")
