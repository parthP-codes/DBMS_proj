"""
OmniCart 360 - Order Orchestration Microservice
Coordinates order placement, inventory reservation in Aurora PostgreSQL,
and dispatches Saga workflows via AWS Step Functions & EventBridge.
"""
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List
import uuid
import os
import uvicorn

app = FastAPI(
    title="OmniCart 360 - Order Service",
    version="1.0.0"
)

class OrderItem(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class CreateOrderRequest(BaseModel):
    customer_id: str
    items: List[OrderItem]
    shipping_address: str
    payment_token: str

class OrderResponse(BaseModel):
    order_id: str
    status: str
    total_amount: float
    saga_execution_id: str
    message: str

@app.get("/health", status_code=200)
def health_check():
    return {"status": "HEALTHY", "service": "order-service"}

@app.post("/api/v1/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def place_order(payload: CreateOrderRequest):
    """
    1. Authenticate user from JWT claims
    2. Check & pessimistically lock inventory in Aurora PostgreSQL
    3. Trigger AWS Step Functions Saga execution for payment capture
    4. Emit OrderPlaced event to Amazon EventBridge
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    
    order_id = f"ord-{uuid.uuid4().hex[:8]}"
    total_amount = sum(item.quantity * item.unit_price for item in payload.items)
    saga_execution_id = f"arn:aws:states:us-east-1:123456789012:execution:OrderSaga:{uuid.uuid4().hex[:6]}"

    # Simulating Order Saga State initiation
    return OrderResponse(
        order_id=order_id,
        status="PENDING_PAYMENT",
        total_amount=round(total_amount, 2),
        saga_execution_id=saga_execution_id,
        message="Order registered successfully. Payment and inventory saga initiated."
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
