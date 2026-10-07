"""
POST /api/auth/register must never leave a user in the Cognito pool unless the account is fully usable.

Regression for: signing up with a password that breaks the pool's password policy returned an error
but still added the (half-created, FORCE_CHANGE_PASSWORD) user to the pool, which then blocked any retry
with "account already exists".
"""
import pytest
from botocore.exceptions import ClientError

import server
from conftest import create_user_pool, request_json

EMAIL = "new.user@example.com"
VALID_PASSWORD = "Password123"  # the pool does not require a symbol


def register(api, password, email=EMAIL):
    return request_json(api, "/api/auth/register", {"name": "New User", "email": email, "password": password})


def pool_users(cognito, pool_id):
    return cognito.list_users(UserPoolId=pool_id)["Users"]


@pytest.mark.parametrize(
    "password, expected_rule",
    [
        ("Ab1", "at least 8 characters"),
        ("password123", "uppercase"),
        ("PASSWORD123", "lowercase"),
        ("PasswordOnly", "number"),
    ],
)
def test_password_breaking_the_policy_is_rejected_and_no_user_is_created(
    api, cognito, user_pool, password, expected_rule
):
    status, body = register(api, password)

    assert status == 400
    assert expected_rule in body["error"]
    assert pool_users(cognito, user_pool) == []


def test_every_broken_rule_is_reported_at_once(api, user_pool):
    status, body = register(api, "abc")

    assert status == 400
    for rule in ("at least 8 characters", "uppercase", "number"):
        assert rule in body["error"]


def test_valid_password_creates_a_confirmed_user(api, cognito, user_pool):
    status, body = register(api, VALID_PASSWORD)

    assert status == 201
    assert body["status"] == "SUCCESS"
    (user,) = pool_users(cognito, user_pool)
    assert user["UserStatus"] == "CONFIRMED"


def test_user_can_retry_with_a_valid_password_after_a_rejected_one(api, cognito, user_pool):
    assert register(api, "weak")[0] == 400

    status, _ = register(api, VALID_PASSWORD)

    assert status == 201  # used to be 409 "account already exists" because of the half-created user
    assert len(pool_users(cognito, user_pool)) == 1


def test_user_is_rolled_back_when_cognito_rejects_a_password_the_local_check_accepted(
    api, cognito, monkeypatch
):
    # The live pool is stricter than the policy mirrored in server.py (e.g. edited in the console).
    pool_id = create_user_pool(cognito, monkeypatch, RequireSymbols=True)

    status, body = register(api, VALID_PASSWORD)

    assert status == 400
    assert "password" in body["error"].lower()
    assert pool_users(cognito, pool_id) == []


def test_original_error_is_returned_even_if_the_rollback_itself_fails(api, cognito, monkeypatch):
    pool_id = create_user_pool(cognito, monkeypatch, RequireSymbols=True)
    real_client = server.boto3.client

    class ClientWithoutDeletePermission:
        def __init__(self, *args, **kwargs):
            self._client = real_client(*args, **kwargs)
            self.exceptions = self._client.exceptions

        def __getattr__(self, name):
            return getattr(self._client, name)

        def admin_delete_user(self, **kwargs):
            raise ClientError({"Error": {"Code": "AccessDeniedException", "Message": "denied"}}, "AdminDeleteUser")

    monkeypatch.setattr(server.boto3, "client", ClientWithoutDeletePermission)

    status, body = register(api, VALID_PASSWORD)

    assert status == 400
    assert "denied" not in body["error"]  # the password problem is reported, not the cleanup failure
    assert len(pool_users(cognito, pool_id)) == 1  # nothing we could do; it is at least logged


def test_registering_an_existing_email_returns_409_and_keeps_the_existing_user(api, cognito, user_pool):
    assert register(api, VALID_PASSWORD)[0] == 201

    status, body = register(api, "Another1Password")

    assert status == 409
    assert "already exists" in body["error"]
    assert len(pool_users(cognito, user_pool)) == 1


def test_missing_email_or_password_is_still_a_400(api, user_pool):
    status, body = request_json(api, "/api/auth/register", {"email": "", "password": ""})

    assert status == 400
    assert body["error"] == "Email and password are required."
