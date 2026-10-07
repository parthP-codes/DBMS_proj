"""
Shared fixtures. AWS is emulated in-process with moto, so no credentials or network are needed.

Note: moto is an emulator, not AWS. These tests check this project's logic against its behaviour;
the Cognito password rules themselves are enforced by the real service.
"""
import json
import threading
import urllib.error
import urllib.request
from http.server import HTTPServer

import boto3
import pytest
from moto import mock_aws

import server

# Same rules as CognitoUserPool.PasswordPolicy in infrastructure/cloudformation/omnicart_platform.yaml
PASSWORD_POLICY = {
    "MinimumLength": 8,
    "RequireLowercase": True,
    "RequireNumbers": True,
    "RequireSymbols": False,
    "RequireUppercase": True,
}


@pytest.fixture(autouse=True)
def fake_aws_credentials(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", server.REGION)


@pytest.fixture
def aws():
    with mock_aws():
        yield


@pytest.fixture
def cognito(aws):
    return boto3.client("cognito-idp", region_name=server.REGION)


def create_user_pool(cognito, monkeypatch, **policy_overrides):
    """Create a pool and app client shaped like the ones in the CloudFormation template and point server.py at them."""
    pool = cognito.create_user_pool(
        PoolName="omnicart-test",
        UsernameAttributes=["email"],
        Policies={"PasswordPolicy": {**PASSWORD_POLICY, **policy_overrides}},
    )
    pool_id = pool["UserPool"]["Id"]
    client = cognito.create_user_pool_client(
        UserPoolId=pool_id, ClientName="omnicart-test", ExplicitAuthFlows=["ALLOW_ADMIN_USER_PASSWORD_AUTH"]
    )
    monkeypatch.setattr(server, "USER_POOL_ID", pool_id)
    monkeypatch.setattr(server, "CLIENT_ID", client["UserPoolClient"]["ClientId"])
    return pool_id


@pytest.fixture
def user_pool(cognito, monkeypatch):
    return create_user_pool(cognito, monkeypatch)


@pytest.fixture
def products_table(aws):
    """The products table exactly as defined in the CloudFormation template."""
    boto3.client("dynamodb", region_name=server.REGION).create_table(
        TableName="omnicart-prod-products",
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "ProductId", "AttributeType": "S"},
            {"AttributeName": "Category", "AttributeType": "S"},
        ],
        KeySchema=[{"AttributeName": "ProductId", "KeyType": "HASH"}],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "CategoryIndex",
                "KeySchema": [{"AttributeName": "Category", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )
    return boto3.resource("dynamodb", region_name=server.REGION).Table("omnicart-prod-products")


@pytest.fixture
def carts_table(aws):
    """The carts table exactly as defined in the CloudFormation template (PK + SK, TTL on the TTL attribute)."""
    dynamodb = boto3.client("dynamodb", region_name=server.REGION)
    dynamodb.create_table(
        TableName="omnicart-prod-carts",
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
    )
    dynamodb.update_time_to_live(
        TableName="omnicart-prod-carts", TimeToLiveSpecification={"AttributeName": "TTL", "Enabled": True}
    )
    return boto3.resource("dynamodb", region_name=server.REGION).Table("omnicart-prod-carts")


@pytest.fixture
def order_queue(aws):
    """The order queue; call the returned function to read the orders that have been queued so far."""
    sqs = boto3.client("sqs", region_name=server.REGION)
    queue_url = sqs.create_queue(QueueName="omnicart-prod-order-fulfillment")["QueueUrl"]

    def queued_orders():
        messages = sqs.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=10).get("Messages", [])
        return [json.loads(message["Body"]) for message in messages]

    return queued_orders


@pytest.fixture
def api(aws):
    """The real OmniCart request handler served on a free local port."""
    httpd = HTTPServer(("127.0.0.1", 0), server.OmniCartRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()
    httpd.server_close()


# Talk to the local test server directly, even when an HTTP proxy is set in the environment
_direct = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request_json(base_url, path, payload=None, *, method=None, token=None):
    """
    Call the API. No payload = GET; a payload = POST (or `method`), sent as JSON (bytes are sent as they are).
    `token` is sent as 'Authorization: Bearer <token>'. Returns (status_code, parsed_json).
    """
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is None or isinstance(payload, bytes):
        data = payload
    else:
        data = json.dumps(payload).encode()
    request = urllib.request.Request(
        base_url + path, data=data, headers=headers, method=method or ("GET" if data is None else "POST")
    )
    try:
        with _direct.open(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as err:
        return err.code, json.load(err)
