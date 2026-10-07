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
    """Create a pool shaped like the one in the CloudFormation template and point server.py at it."""
    pool = cognito.create_user_pool(
        PoolName="omnicart-test",
        UsernameAttributes=["email"],
        Policies={"PasswordPolicy": {**PASSWORD_POLICY, **policy_overrides}},
    )
    monkeypatch.setattr(server, "USER_POOL_ID", pool["UserPool"]["Id"])
    return pool["UserPool"]["Id"]


@pytest.fixture
def user_pool(cognito, monkeypatch):
    return create_user_pool(cognito, monkeypatch)


@pytest.fixture
def api(aws):
    """The real OmniCart request handler served on a free local port."""
    httpd = HTTPServer(("127.0.0.1", 0), server.OmniCartRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()
    httpd.server_close()


def request_json(base_url, path, payload=None):
    """GET (no payload) or POST (payload) against the API. Returns (status_code, parsed_json)."""
    request = urllib.request.Request(
        base_url + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="GET" if payload is None else "POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as err:
        return err.code, json.load(err)
