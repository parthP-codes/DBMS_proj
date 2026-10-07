"""
The product catalogue: data/products.json (the seed data), test_platform.populate_dynamodb_products()
(loads it into DynamoDB) and GET /api/products (what the storefront reads).
"""
import json
import re
from decimal import Decimal
from pathlib import Path

import boto3
import pytest

import server
import test_platform
from conftest import request_json

PRODUCTS_FILE = Path(__file__).resolve().parent.parent / "data" / "products.json"
LOW_STOCK_BELOW = 20  # convention of the original sample data: 15 units = LOW_STOCK, 35 = IN_STOCK


@pytest.fixture(scope="module")
def products():
    return json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"), parse_float=Decimal)


# --- seed data -------------------------------------------------------------------------------------

def test_catalogue_has_at_least_100_products(products):
    assert len(products) >= 100


def test_catalogue_covers_a_wide_variety_of_categories(products):
    assert len({p["Category"] for p in products}) >= 20


def test_product_ids_are_unique_and_well_formed(products):
    ids = [p["ProductId"] for p in products]
    assert len(ids) == len(set(ids))
    assert all(re.fullmatch(r"prod-\d{3,}", product_id) for product_id in ids)


def test_product_names_are_unique(products):
    names = [p["Name"] for p in products]
    assert len(names) == len(set(names))


def test_every_product_has_exactly_the_attributes_the_storefront_uses(products):
    for p in products:
        assert set(p) == {"ProductId", "Category", "Name", "Price", "Stock", "Status"}, p["ProductId"]
        assert isinstance(p["Price"], Decimal) and p["Price"] > 0, p["ProductId"]
        assert p["Price"] == p["Price"].quantize(Decimal("0.01")), f"{p['ProductId']}: more than 2 decimals"
        assert isinstance(p["Stock"], int) and p["Stock"] >= 0, p["ProductId"]


def test_status_matches_stock_level(products):
    for p in products:
        expected = "LOW_STOCK" if p["Stock"] < LOW_STOCK_BELOW else "IN_STOCK"
        assert p["Status"] == expected, p["ProductId"]


def test_text_is_plain_and_safe_to_render(products):
    # Category is a DynamoDB key (must be non-empty); Name/Category end up inside HTML on the storefront.
    for p in products:
        for field in ("ProductId", "Category", "Name"):
            value = p[field]
            assert value and value == value.strip(), f"{p['ProductId']}.{field}"
            assert not set('<>"') & set(value), f"{p['ProductId']}.{field}: {value!r}"


def test_original_sample_products_are_unchanged(products):
    by_id = {p["ProductId"]: p for p in products}
    assert by_id["prod-101"] == {"ProductId": "prod-101", "Category": "Electronics", "Name": "Wireless Noise-Canceling Headphones", "Price": Decimal("199.99"), "Stock": 50, "Status": "IN_STOCK"}
    assert by_id["prod-102"] == {"ProductId": "prod-102", "Category": "Electronics", "Name": "Mechanical Ergonomic Keyboard", "Price": Decimal("129.50"), "Stock": 35, "Status": "IN_STOCK"}
    assert by_id["prod-103"] == {"ProductId": "prod-103", "Category": "Displays", "Name": "4K Ultra-HD Smart Monitor 32-inch", "Price": Decimal("349.00"), "Stock": 15, "Status": "LOW_STOCK"}


# --- seeding DynamoDB ------------------------------------------------------------------------------

def test_seeding_writes_every_product_to_dynamodb(products, products_table):
    assert test_platform.populate_dynamodb_products() is True

    stored = products_table.scan()["Items"]
    assert {p["ProductId"]: p for p in stored} == {p["ProductId"]: p for p in products}  # every attribute, not just ids


def test_seeded_products_can_be_queried_by_category(products, products_table):
    test_platform.populate_dynamodb_products()

    displays = products_table.query(
        IndexName="CategoryIndex", KeyConditionExpression=boto3.dynamodb.conditions.Key("Category").eq("Displays")
    )["Items"]

    assert len(displays) == sum(p["Category"] == "Displays" for p in products) >= 2


def test_seeding_twice_does_not_duplicate_anything(products, products_table):
    test_platform.populate_dynamodb_products()
    test_platform.populate_dynamodb_products()

    assert products_table.scan()["Count"] == len(products)


# --- what the storefront receives ------------------------------------------------------------------

def test_api_serves_the_whole_catalogue_sorted_by_id(api, products, products_table):
    test_platform.populate_dynamodb_products()

    status, served = request_json(api, "/api/products")

    assert status == 200
    assert len(served) == len(products)
    assert [p["ProductId"] for p in served] == sorted(p["ProductId"] for p in products)
    headphones = next(p for p in served if p["ProductId"] == "prod-101")
    assert headphones["Price"] == 199.99 and headphones["Name"] == "Wireless Noise-Canceling Headphones"
