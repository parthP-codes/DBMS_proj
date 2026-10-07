"""
OmniCart 360 - Frontend Demo Server
Connects the modern HTML/JS Storefront directly to live AWS DynamoDB, SQS, and Amazon Cognito in us-east-1.
Runs out-of-the-box using standard Python libraries + boto3.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import time
import os
import sys
from decimal import Decimal
import boto3

REGION = "us-east-1"
PORT = 8000
USER_POOL_ID = "us-east-1_HNnLI9NzL"
CLIENT_ID = "5lv31ch5jipcofi363s2l16cg9"

# Mirrors CognitoUserPool.PasswordPolicy in infrastructure/cloudformation/omnicart_platform.yaml
# (no symbol required). Checked up front so a bad password is rejected before anything is created in Cognito.
MIN_PASSWORD_LENGTH = 8

# Helper to serialize Decimal types from DynamoDB to JSON
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

# Helper returning what a password is missing, as phrases for "Password must ..." (empty list = OK)
def password_policy_violations(password):
    checks = [
        (len(password) >= MIN_PASSWORD_LENGTH, f"be at least {MIN_PASSWORD_LENGTH} characters long"),
        (any(c.isupper() for c in password), "contain an uppercase letter"),
        (any(c.islower() for c in password), "contain a lowercase letter"),
        (any(c.isdigit() for c in password), "contain a number"),
    ]
    return [requirement for passed, requirement in checks if not passed]

class OmniCartRequestHandler(SimpleHTTPRequestHandler):
    
    def do_GET(self):
        # 1. API: Fetch live products from DynamoDB
        if self.path == "/api/products":
            try:
                dynamodb = boto3.resource('dynamodb', region_name=REGION)
                table = dynamodb.Table('omnicart-prod-products')
                response = table.scan()
                items = response.get('Items', [])
                items = sorted(items, key=lambda x: x.get('ProductId', ''))
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(items, default=decimal_default).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # 2. API: System Status & Cloud Endpoints
        elif self.path == "/api/status":
            status_payload = {
                "region": REGION,
                "account_id": "404006608500",
                "dynamodb_table": "omnicart-prod-products",
                "sqs_queue": "omnicart-prod-order-fulfillment",
                "cognito_user_pool": USER_POOL_ID,
                "cognito_client_id": CLIENT_ID,
                "alb_dns": "omnicart-prod-alb-935495462.us-east-1.elb.amazonaws.com",
                "status": "ONLINE"
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(status_payload).encode('utf-8'))
            return

        # 3. Serve Frontend Root
        elif self.path == "/" or self.path == "/index.html":
            frontend_path = os.path.join(os.path.dirname(__file__), 'frontend', 'index.html')
            if os.path.exists(frontend_path):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                with open(frontend_path, 'rb') as f:
                    self.wfile.write(f.read())
                return

        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body) if body else {}

        # 1. API: User Sign Up / Account Creation in Amazon Cognito
        if self.path == "/api/auth/register":
            email = data.get('email', '').strip()
            password = data.get('password', '')
            full_name = data.get('name', 'Retail Customer')

            if not email or not password:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Email and password are required."}).encode('utf-8'))
                return

            violations = password_policy_violations(password)
            if violations:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Password must " + ", ".join(violations) + "."}).encode('utf-8'))
                return

            try:
                client = boto3.client('cognito-idp', region_name=REGION)
                
                # Create user in Cognito User Pool
                res = client.admin_create_user(
                    UserPoolId=USER_POOL_ID,
                    Username=email,
                    UserAttributes=[
                        {'Name': 'email', 'Value': email},
                        {'Name': 'email_verified', 'Value': 'true'},
                        {'Name': 'name', 'Value': full_name}
                    ],
                    MessageAction='SUPPRESS'
                )

                # Set permanent password
                try:
                    client.admin_set_user_password(
                        UserPoolId=USER_POOL_ID,
                        Username=email,
                        Password=password,
                        Permanent=True
                    )
                except Exception:
                    # Don't leave a half-created user (stuck in FORCE_CHANGE_PASSWORD) in the pool,
                    # e.g. when the live pool policy is stricter than the check above.
                    try:
                        client.admin_delete_user(UserPoolId=USER_POOL_ID, Username=res['User']['Username'])
                    except Exception as cleanup_error:
                        print(f"[WARN] Could not remove half-created Cognito user {email}: {cleanup_error}", file=sys.stderr)
                    raise

                response_data = {
                    "status": "SUCCESS",
                    "email": email,
                    "user_sub": res['User']['Username'],
                    "cognito_user_pool": USER_POOL_ID,
                    "message": f"Account successfully created in Amazon Cognito User Pool: {USER_POOL_ID}"
                }

                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            except client.exceptions.UsernameExistsException:
                self.send_response(409)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "An account with this email already exists in Cognito."}).encode('utf-8'))
            except client.exceptions.InvalidPasswordException as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": e.response['Error']['Message']}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # 2. API: User Sign In & JWT Issuance via Amazon Cognito
        elif self.path == "/api/auth/login":
            email = data.get('email', '').strip()
            password = data.get('password', '')

            try:
                client = boto3.client('cognito-idp', region_name=REGION)
                auth_res = client.admin_initiate_auth(
                    UserPoolId=USER_POOL_ID,
                    ClientId=CLIENT_ID,
                    AuthFlow='ADMIN_NO_SRP_AUTH',
                    AuthParameters={
                        'USERNAME': email,
                        'PASSWORD': password
                    }
                )

                auth_result = auth_res.get('AuthenticationResult', {})
                id_token = auth_result.get('IdToken')
                access_token = auth_result.get('AccessToken')

                response_data = {
                    "status": "SUCCESS",
                    "email": email,
                    "id_token": id_token,
                    "access_token": access_token,
                    "token_type": "Bearer",
                    "expires_in": auth_result.get('ExpiresIn', 3600),
                    "message": "Authenticated successfully via Amazon Cognito OIDC."
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            except client.exceptions.NotAuthorizedException:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Incorrect email or password."}).encode('utf-8'))
            except client.exceptions.UserNotFoundException:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "User does not exist in Cognito. Please sign up first."}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # 3. API: Process Checkout & Enqueue to AWS SQS
        elif self.path == "/api/orders":
            try:
                order_id = f"ORD-{int(time.time())}"
                items = data.get('items', [])
                total_amount = sum(item.get('price', 0) * item.get('quantity', 1) for item in items)
                customer_email = data.get('customer_email', 'guest@omnicart.com')

                sqs = boto3.client('sqs', region_name=REGION)
                sts = boto3.client('sts', region_name=REGION)
                account_id = sts.get_caller_identity()['Account']
                queue_url = f"https://sqs.{REGION}.amazonaws.com/{account_id}/omnicart-prod-order-fulfillment"

                order_payload = {
                    "order_id": order_id,
                    "customer_email": customer_email,
                    "items": items,
                    "total_amount": round(total_amount, 2),
                    "shipping_address": data.get('shipping_address', 'University Campus'),
                    "payment_status": "AUTHORIZED",
                    "cognito_verified": bool(data.get('customer_email')),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }

                sqs_res = sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps(order_payload)
                )

                response_data = {
                    "status": "SUCCESS",
                    "order_id": order_id,
                    "total_amount": round(total_amount, 2),
                    "sqs_message_id": sqs_res.get('MessageId'),
                    "customer_email": customer_email,
                    "message": "Order successfully received and buffered into Amazon SQS."
                }

                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    print("=" * 65)
    print("   OmniCart 360 - Frontend & Cloud Integration Server")
    print("=" * 65)
    print(f"[*] Connecting to AWS Region:   {REGION}")
    print(f"[*] Amazon Cognito User Pool:  {USER_POOL_ID}")
    print(f"[*] Local Storefront URL:      http://localhost:{PORT}")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    server = HTTPServer(('0.0.0.0', PORT), OmniCartRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()
