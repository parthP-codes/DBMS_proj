"""
OmniCart 360 - Product Catalog Microservice
Handles high-throughput product catalog queries with Redis in-memory caching and DynamoDB fallback.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import uvicorn

app = FastAPI(
    title="OmniCart 360 - Product Catalog Service",
    version="1.0.0",
    docs_url="/docs"
)

class Product(BaseModel):
    id: str
    name: str
    category: str
    price: float
    stock: int
    image_url: str

# Sample Mock Database / Cache
MOCK_PRODUCTS = {
    "prod-101": Product(id="prod-101", name="Wireless Noise-Canceling Headphones", category="Electronics", price=199.99, stock=45, image_url="https://cdn.omnicart.com/assets/prod-101.webp"),
    "prod-102": Product(id="prod-102", name="Ergonomic Mechanical Keyboard", category="Electronics", price=129.50, stock=20, image_url="https://cdn.omnicart.com/assets/prod-102.webp"),
    "prod-103": Product(id="prod-103", name="4K Ultra-HD Smart Monitor", category="Displays", price=349.00, stock=12, image_url="https://cdn.omnicart.com/assets/prod-103.webp"),
}

@app.get("/health", status_code=200)
def health_check():
    """ECS ALB Health Check endpoint"""
    return {"status": "HEALTHY", "service": "catalog-service"}

@app.get("/api/v1/catalog/products", response_model=List[Product])
def list_products(category: Optional[str] = None):
    """Retrieve catalog products with optional category filtering"""
    if category:
        return [p for p in MOCK_PRODUCTS.values() if p.category.lower() == category.lower()]
    return list(MOCK_PRODUCTS.values())

@app.get("/api/v1/catalog/products/{product_id}", response_model=Product)
def get_product(product_id: str):
    """Fetch product details by ID (checks Redis cache -> DynamoDB)"""
    if product_id not in MOCK_PRODUCTS:
        raise HTTPException(status_code=404, detail="Product not found")
    return MOCK_PRODUCTS[product_id]

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
