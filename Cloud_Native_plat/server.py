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

PRODUCTS_TABLE = "omnicart-prod-products"
CARTS_TABLE = "omnicart-prod-carts"
CART_TTL_DAYS = 30      # DynamoDB removes a saved cart (via its TTL attribute) this long after its last change
MAX_CART_LINES = 100    # one DynamoDB BatchGetItem reads at most 100 keys
MAX_LINE_QUANTITY = 99

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

# An error to report to the browser as JSON with this HTTP status
class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status

# Who is signed in? Cognito itself checks the access token (signature, expiry, sign-out), so no JWT library is needed.
# Returns {'sub', 'email'}. No Authorization header means a guest (None) when required=False, otherwise a 401.
def signed_in_user(headers, required):
    scheme, _, token = headers.get('Authorization', '').partition(' ')
    token = token.strip()
    if scheme.lower() != 'bearer' or not token:
        if required:
            raise ApiError(401, "Please sign in first.")
        return None

    client = boto3.client('cognito-idp', region_name=REGION)
    try:
        user = client.get_user(AccessToken=token)
    except (client.exceptions.NotAuthorizedException, client.exceptions.UserNotFoundException):
        raise ApiError(401, "Your session has expired or is invalid. Please sign in again.")
    attributes = {a['Name']: a['Value'] for a in user['UserAttributes']}
    return {'sub': attributes.get('sub', user['Username']), 'email': attributes.get('email', user['Username'])}

# Turns [{'product_id', 'quantity'}] from the browser into cart/order lines. Name and Price always come from the
# products table, never from the browser. The same product listed twice is merged. Raises ApiError(400) on bad input;
# skip_unknown=True drops products that no longer exist instead.
def catalog_lines(items, skip_unknown=False):
    if not isinstance(items, list) or len(items) > MAX_CART_LINES:
        raise ApiError(400, f"items must be a list of at most {MAX_CART_LINES} products.")

    quantities = {}
    for item in items:
        product_id = item.get('product_id') if isinstance(item, dict) else None
        quantity = item.get('quantity') if isinstance(item, dict) else None
        if not isinstance(product_id, str) or not product_id or not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
            raise ApiError(400, "Each item needs a product_id and a whole-number quantity of at least 1.")
        quantities[product_id] = quantities.get(product_id, 0) + quantity
    if any(quantity > MAX_LINE_QUANTITY for quantity in quantities.values()):
        raise ApiError(400, f"You can order at most {MAX_LINE_QUANTITY} of one product.")
    if not quantities:
        return []

    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    keys, products = [{'ProductId': product_id} for product_id in quantities], {}
    for _ in range(5):  # BatchGetItem can hand back some keys unprocessed when it is throttled
        response = dynamodb.batch_get_item(RequestItems={PRODUCTS_TABLE: {'Keys': keys}})
        products.update({p['ProductId']: p for p in response['Responses'][PRODUCTS_TABLE]})
        keys = response.get('UnprocessedKeys', {}).get(PRODUCTS_TABLE, {}).get('Keys', [])
        if not keys:
            break
    else:
        raise RuntimeError("The products table is busy, please try again.")

    lines = []
    for product_id, quantity in quantities.items():
        if product_id not in products:
            if skip_unknown:
                continue
            raise ApiError(400, f"Unknown product: {product_id}")
        lines.append({'ProductId': product_id, 'Name': products[product_id]['Name'], 'Price': products[product_id]['Price'], 'Quantity': quantity})
    return lines

# (units, subtotal) of cart or order lines
def cart_totals(lines):
    units = sum(line['Quantity'] for line in lines)
    return units, sum((line['Price'] * line['Quantity'] for line in lines), Decimal('0')).quantize(Decimal('0.01'))

# The cart as JSON for the browser, including where it lives in DynamoDB so it can be found in the AWS console
def cart_json(user, lines):
    item_count, subtotal = cart_totals(lines)
    return {
        "items": [{"product_id": line['ProductId'], "name": line['Name'], "price": line['Price'], "quantity": line['Quantity']} for line in lines],
        "item_count": item_count,
        "subtotal": subtotal,
        "dynamodb": {"table": CARTS_TABLE, **cart_key(user)}
    }

# One DynamoDB item per user: PK = USER#<Cognito sub>, SK = CART
def cart_key(user):
    return {'PK': f"USER#{user['sub']}", 'SK': 'CART'}

def carts_table():
    return boto3.resource('dynamodb', region_name=REGION).Table(CARTS_TABLE)

# The user's saved cart, re-priced from the current catalogue (products that no longer exist drop out)
def load_cart(user):
    row = carts_table().get_item(Key=cart_key(user), ConsistentRead=True).get('Item')
    if row is None or row['TTL'] < time.time():  # DynamoDB deletes expired items lazily, so check the TTL ourselves
        return []
    return catalog_lines([{'product_id': line['ProductId'], 'quantity': int(line['Quantity'])} for line in row['Items']], skip_unknown=True)

# Replaces the user's saved cart; an empty cart deletes the item
def save_cart(user, lines):
    if not lines:
        return delete_cart(user)
    now = int(time.time())
    item_count, subtotal = cart_totals(lines)
    carts_table().put_item(Item={
        **cart_key(user),
        'Email': user['email'],
        'Items': lines,
        'ItemCount': item_count,
        'Subtotal': subtotal,
        'UpdatedAt': time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
        'TTL': now + CART_TTL_DAYS * 24 * 60 * 60
    })

def delete_cart(user):
    carts_table().delete_item(Key=cart_key(user))

class OmniCartRequestHandler(SimpleHTTPRequestHandler):

    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload, default=decimal_default).encode('utf-8'))

    def read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
        except ValueError:
            raise ApiError(400, "The request body is not valid JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "The request body must be a JSON object.")
        return data

    
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

        # 4. API: The signed-in user's saved cart (DynamoDB table omnicart-prod-carts)
        elif self.path == "/api/cart":
            try:
                user = signed_in_user(self.headers, required=True)
                self.send_json(200, cart_json(user, load_cart(user)))
            except ApiError as e:
                self.send_json(e.status, {"error": str(e)})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        return super().do_GET()

    def do_PUT(self):
        # API: Replace the signed-in user's saved cart in DynamoDB (an empty list clears it)
        if self.path == "/api/cart":
            try:
                user = signed_in_user(self.headers, required=True)
                lines = catalog_lines(self.read_json().get('items'))
                save_cart(user, lines)
                self.send_json(200, cart_json(user, lines))
            except ApiError as e:
                self.send_json(e.status, {"error": str(e)})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body) if body else {}

        # 1. API: User Sign Up / Account Creation in Amazon Cognito
        if self.path == "/api/auth/register":
            email = data.get('email', '').strip()
            password = data.get('password', '')
            full_name = data.get('name', 'Retail Customer')

            if not email or not isinstance(password, str) or not password:
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
                # Who is ordering comes from the verified sign-in token (no token = guest), and prices from the catalogue
                user = signed_in_user(self.headers, required=False)
                lines = catalog_lines(data.get('items'))
                if not lines:
                    raise ApiError(400, "Your cart is empty.")
                order_id = f"ORD-{int(time.time())}"
                total_amount = cart_totals(lines)[1]
                customer_email = user['email'] if user else 'guest@omnicart.com'

                sqs = boto3.client('sqs', region_name=REGION)
                sts = boto3.client('sts', region_name=REGION)
                account_id = sts.get_caller_identity()['Account']
                queue_url = f"https://sqs.{REGION}.amazonaws.com/{account_id}/omnicart-prod-order-fulfillment"

                order_payload = {
                    "order_id": order_id,
                    "customer_email": customer_email,
                    "items": [{"product_id": line['ProductId'], "name": line['Name'], "quantity": line['Quantity'], "price": line['Price']} for line in lines],
                    "total_amount": total_amount,
                    "shipping_address": data.get('shipping_address', 'University Campus'),
                    "payment_status": "AUTHORIZED",
                    "cognito_verified": user is not None,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }

                sqs_res = sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps(order_payload, default=decimal_default)
                )

                # The order is queued, so empty the saved cart. Don't fail the order if only this clean-up fails.
                cart_cleared = False
                if user:
                    try:
                        delete_cart(user)
                        cart_cleared = True
                    except Exception as cleanup_error:
                        print(f"[WARN] Order {order_id} was queued but the saved cart of {customer_email} could not be cleared: {cleanup_error}", file=sys.stderr)

                response_data = {
                    "status": "SUCCESS",
                    "order_id": order_id,
                    "total_amount": float(total_amount),
                    "sqs_message_id": sqs_res.get('MessageId'),
                    "customer_email": customer_email,
                    "saved_cart_cleared": cart_cleared,
                    "message": "Order successfully received and buffered into Amazon SQS."
                }

                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            except ApiError as e:
                self.send_json(e.status, {"error": str(e)})
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
