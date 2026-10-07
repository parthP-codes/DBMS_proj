"""
Per-user carts (GET/PUT /api/cart) and checkout (POST /api/orders), with Cognito, DynamoDB and SQS emulated.

A signed-in user's cart is one item in omnicart-prod-carts (PK USER#<Cognito sub>, SK CART). Who the user is comes
from the sign-in token, never from anything the browser says; names and prices come from the products table.
"""
import calendar
import time
from decimal import Decimal

import pytest

import server
import test_platform
from conftest import request_json

PASSWORD = "Password123"
HEADPHONES, SPEAKER = "prod-101", "prod-104"  # 199.99 and 49.99 in data/products.json
THIRTY_DAYS = 30 * 24 * 60 * 60


@pytest.fixture
def shop(api, user_pool, products_table, carts_table, order_queue):
    """A running storefront with the full catalogue loaded. Returns the API's base URL."""
    test_platform.populate_dynamodb_products()
    return api


def sign_in(shop, email="shopper@example.com"):
    """Sign up and sign in through the real endpoints. Returns the user with the tokens the browser would hold."""
    status, account = request_json(
        shop, "/api/auth/register", {"name": "Test Shopper", "email": email, "password": PASSWORD}
    )
    assert status == 201
    status, tokens = request_json(shop, "/api/auth/login", {"email": email, "password": PASSWORD})
    assert status == 200
    return {"email": email, "sub": account["user_sub"], "token": tokens["access_token"], "id_token": tokens["id_token"]}


def line(product_id, quantity):
    return {"product_id": product_id, "quantity": quantity}


def save(shop, user, items):
    return request_json(shop, "/api/cart", {"items": items}, method="PUT", token=user["token"])


def load(shop, user):
    return request_json(shop, "/api/cart", token=user["token"])


def stored_cart(carts_table, user):
    return carts_table.get_item(Key={"PK": f"USER#{user['sub']}", "SK": "CART"}).get("Item")


def product_ids(cart):
    return [item["product_id"] for item in cart["items"]]


# --- who is asking ---------------------------------------------------------------------------------

@pytest.mark.parametrize("method, payload", [(None, None), ("PUT", {"items": []})])
def test_the_cart_needs_a_sign_in(shop, method, payload):
    assert request_json(shop, "/api/cart", payload, method=method)[0] == 401


def test_the_cart_rejects_tokens_that_are_not_valid_access_tokens(shop):
    user = sign_in(shop)

    for token in ("not-a-real-token", user["id_token"]):  # an ID token is not an access token either
        assert request_json(shop, "/api/cart", token=token)[0] == 401
        assert request_json(shop, "/api/cart", {"items": [line(HEADPHONES, 1)]}, method="PUT", token=token)[0] == 401


def test_signing_out_everywhere_ends_the_session(shop, cognito, user_pool):
    user = sign_in(shop)
    assert load(shop, user)[0] == 200

    cognito.admin_user_global_sign_out(UserPoolId=user_pool, Username=user["email"])

    assert load(shop, user)[0] == 401


# --- loading and saving ----------------------------------------------------------------------------

def test_a_new_user_has_an_empty_cart_and_is_told_where_it_will_live(shop):
    user = sign_in(shop)

    status, cart = load(shop, user)

    assert status == 200
    assert cart["items"] == [] and cart["item_count"] == 0
    assert cart["dynamodb"] == {"table": "omnicart-prod-carts", "PK": f"USER#{user['sub']}", "SK": "CART"}


def test_saving_stores_one_item_for_the_user_priced_from_the_catalogue(shop, carts_table):
    user = sign_in(shop)

    status, cart = request_json(
        shop,
        "/api/cart",
        {"items": [{"product_id": HEADPHONES, "quantity": 2, "name": "Free headphones", "price": 0.01}, line(SPEAKER, 1)]},
        method="PUT",
        token=user["token"],
    )

    assert status == 200
    assert cart["item_count"] == 3 and cart["subtotal"] == 449.97  # the browser's name and price were ignored
    row = stored_cart(carts_table, user)
    assert row["Email"] == user["email"]
    assert row["ItemCount"] == 3 and row["Subtotal"] == Decimal("449.97")
    assert row["Items"] == [
        {"ProductId": HEADPHONES, "Name": "Wireless Noise-Canceling Headphones", "Price": Decimal("199.99"), "Quantity": 2},
        {"ProductId": SPEAKER, "Name": "Bluetooth Portable Speaker", "Price": Decimal("49.99"), "Quantity": 1},
    ]
    assert load(shop, user)[1]["items"] == cart["items"]


def test_a_saved_cart_expires_after_30_days_without_changes(shop, carts_table):
    user = sign_in(shop)

    save(shop, user, [line(HEADPHONES, 1)])

    row = stored_cart(carts_table, user)
    assert abs(int(row["TTL"]) - (time.time() + THIRTY_DAYS)) < 120
    saved_at = calendar.timegm(time.strptime(row["UpdatedAt"], "%Y-%m-%dT%H:%M:%SZ"))  # UTC, as the Z says
    assert abs(saved_at - time.time()) < 120


def test_saving_replaces_the_previous_cart(shop, carts_table):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 2), line(SPEAKER, 1)])

    save(shop, user, [line(SPEAKER, 4)])

    cart = load(shop, user)[1]
    assert [(i["product_id"], i["quantity"]) for i in cart["items"]] == [(SPEAKER, 4)]
    assert stored_cart(carts_table, user)["ItemCount"] == 4


def test_saving_an_empty_cart_deletes_the_item(shop, carts_table):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 1)])

    assert save(shop, user, [])[0] == 200

    assert stored_cart(carts_table, user) is None
    assert load(shop, user)[1]["items"] == []


def test_the_same_product_listed_twice_is_merged(shop):
    user = sign_in(shop)

    _, cart = save(shop, user, [line(HEADPHONES, 1), line(HEADPHONES, 2)])

    assert [(i["product_id"], i["quantity"]) for i in cart["items"]] == [(HEADPHONES, 3)]


@pytest.mark.parametrize(
    "items",
    [
        [line("prod-999", 1)],  # not in the catalogue
        [line(HEADPHONES, 0)],
        [line(HEADPHONES, -1)],
        [line(HEADPHONES, 100)],
        [line(HEADPHONES, "2")],
        [line(HEADPHONES, 2.5)],
        [line(HEADPHONES, True)],
        [line(HEADPHONES, None)],
        [{"quantity": 1}],
        [{"product_id": "", "quantity": 1}],
        [{"product_id": 101, "quantity": 1}],
        ["prod-101"],
        [line(HEADPHONES, 50), line(HEADPHONES, 50)],  # 100 of one product once merged
        {"prod-101": 1},  # not a list
        None,
        "prod-101",
        [line(f"prod-{n}", 1) for n in range(101, 202)],  # 101 lines
    ],
)
def test_invalid_carts_are_rejected_and_nothing_is_saved(shop, carts_table, items):
    user = sign_in(shop)

    status, body = save(shop, user, items)

    assert status == 400 and body["error"]
    assert stored_cart(carts_table, user) is None


def test_a_body_that_is_not_a_json_object_is_a_400(shop):
    user = sign_in(shop)

    for body in (b"{not json", b"[]", b'"text"'):
        assert request_json(shop, "/api/cart", body, method="PUT", token=user["token"])[0] == 400


def test_a_cart_past_its_ttl_is_treated_as_empty(shop, carts_table):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 1)])
    # DynamoDB removes expired items lazily (up to ~48h late), so an expired item can still be read
    carts_table.update_item(
        Key={"PK": f"USER#{user['sub']}", "SK": "CART"},
        UpdateExpression="SET #ttl = :past",
        ExpressionAttributeNames={"#ttl": "TTL"},
        ExpressionAttributeValues={":past": int(time.time()) - 60},
    )

    assert load(shop, user)[1]["items"] == []


def test_loading_re_prices_from_the_catalogue_and_drops_discontinued_products(shop, products_table):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 1), line(SPEAKER, 1)])
    products_table.update_item(
        Key={"ProductId": HEADPHONES}, UpdateExpression="SET Price = :p", ExpressionAttributeValues={":p": Decimal("149.99")}
    )
    products_table.delete_item(Key={"ProductId": SPEAKER})

    items = load(shop, user)[1]["items"]

    assert [(i["product_id"], i["price"]) for i in items] == [(HEADPHONES, 149.99)]


# --- one user never sees or touches another's cart -------------------------------------------------

def test_each_user_only_ever_sees_their_own_cart(shop, carts_table):
    alice, bob = sign_in(shop, "alice@example.com"), sign_in(shop, "bob@example.com")
    save(shop, alice, [line(HEADPHONES, 2)])
    assert load(shop, bob)[1]["items"] == []

    # Bob cannot write to Alice's cart by naming her: who he is comes from his token alone
    request_json(
        shop,
        "/api/cart",
        {"items": [line(SPEAKER, 1)], "user": alice["sub"], "PK": f"USER#{alice['sub']}"},
        method="PUT",
        token=bob["token"],
    )

    assert product_ids(load(shop, alice)[1]) == [HEADPHONES]
    assert product_ids(load(shop, bob)[1]) == [SPEAKER]
    assert stored_cart(carts_table, alice)["Email"] == "alice@example.com"
    assert stored_cart(carts_table, bob)["Email"] == "bob@example.com"


# --- checkout --------------------------------------------------------------------------------------

def test_checkout_uses_the_verified_user_and_catalogue_prices_then_empties_the_saved_cart(shop, carts_table, order_queue):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 2)])

    status, order = request_json(
        shop,
        "/api/orders",
        {
            "customer_email": "someone.else@example.com",  # ignored: the token says who is ordering
            "items": [{"product_id": HEADPHONES, "quantity": 2, "price": 0.01, "name": "Free headphones"}],
            "shipping_address": "Hostel 4",
        },
        token=user["token"],
    )

    assert status == 201
    assert order["customer_email"] == user["email"] and order["total_amount"] == 399.98
    assert order["saved_cart_cleared"] is True
    (queued,) = order_queue()
    assert queued["customer_email"] == user["email"] and queued["cognito_verified"] is True
    assert queued["items"] == [
        {"product_id": HEADPHONES, "name": "Wireless Noise-Canceling Headphones", "quantity": 2, "price": 199.99}
    ]
    assert queued["total_amount"] == 399.98 and queued["shipping_address"] == "Hostel 4"
    assert stored_cart(carts_table, user) is None


def test_guest_checkout_still_works_and_is_priced_from_the_catalogue(shop, order_queue):
    status, order = request_json(
        shop,
        "/api/orders",
        {"customer_email": "pretend@example.com", "items": [{"product_id": SPEAKER, "quantity": 3, "price": 0.01}]},
    )

    assert status == 201
    assert order["customer_email"] == "guest@omnicart.com" and order["total_amount"] == 149.97
    assert order["saved_cart_cleared"] is False  # guests have no saved cart
    (queued,) = order_queue()
    assert queued["cognito_verified"] is False and queued["customer_email"] == "guest@omnicart.com"


def test_checkout_with_a_bad_token_is_refused_not_treated_as_a_guest(shop, order_queue):
    status, _ = request_json(shop, "/api/orders", {"items": [line(HEADPHONES, 1)]}, token="not-a-real-token")

    assert status == 401
    assert order_queue() == []


@pytest.mark.parametrize("items", [[], [line("prod-999", 1)], [line(HEADPHONES, -5)], [line(HEADPHONES, 0)], None])
def test_checkout_rejects_empty_or_invalid_carts(shop, order_queue, items):
    status, body = request_json(shop, "/api/orders", {"items": items})

    assert status == 400 and body["error"]
    assert order_queue() == []


def test_an_order_is_still_placed_if_the_saved_cart_cannot_be_cleared(shop, order_queue, monkeypatch):
    user = sign_in(shop)
    save(shop, user, [line(HEADPHONES, 1)])

    def unavailable(user):
        raise RuntimeError("DynamoDB unavailable")

    monkeypatch.setattr(server, "delete_cart", unavailable)

    status, order = request_json(shop, "/api/orders", {"items": [line(HEADPHONES, 1)]}, token=user["token"])

    assert status == 201
    assert order["saved_cart_cleared"] is False  # the browser is told, so it can say so
    assert len(order_queue()) == 1


def test_checking_out_leaves_other_users_carts_alone(shop, carts_table):
    alice, bob = sign_in(shop, "alice@example.com"), sign_in(shop, "bob@example.com")
    save(shop, alice, [line(HEADPHONES, 1)])
    save(shop, bob, [line(SPEAKER, 1)])

    request_json(shop, "/api/orders", {"items": [line(HEADPHONES, 1)]}, token=alice["token"])

    assert stored_cart(carts_table, alice) is None
    assert product_ids(load(shop, bob)[1]) == [SPEAKER]
