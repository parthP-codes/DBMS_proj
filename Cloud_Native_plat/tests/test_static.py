"""
The server must serve the storefront and the API, and nothing else from the project folder
(it used to hand out server.py, deploy.ps1, the infrastructure files, ...).
"""
import urllib.error

import pytest

from conftest import _direct


def fetch(base_url, path):
    try:
        with _direct.open(base_url + path) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as err:
        return err.code, err.headers.get("Content-Type", ""), err.read()


@pytest.mark.parametrize("path", ["/", "/index.html"])
def test_the_storefront_is_served(api, path):
    status, content_type, body = fetch(api, path)

    assert status == 200 and content_type.startswith("text/html")
    assert b"OmniCart" in body


@pytest.mark.parametrize(
    "path",
    [
        "/server.py",
        "/test_platform.py",
        "/deploy.ps1",
        "/destroy.ps1",
        "/data/products.json",
        "/infrastructure/terraform/vpc.tf",
        "/infrastructure/cloudformation/omnicart_platform.yaml",
        "/tests/conftest.py",
        "/.vscode/settings.json",
        "/frontend/",
        "/../server.py",
        "/%2e%2e/server.py",
    ],
)
def test_project_files_are_not_served(api, path):
    status, _, body = fetch(api, path)

    assert status == 404
    assert b"import boto3" not in body
