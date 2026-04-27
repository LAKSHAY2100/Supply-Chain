"""Shipment CRUD-lite: create, list, fetch by id, plus the demo shipment getter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException

from models.schemas import Shipment, ShipmentCreate
from services import firestore as fs_service
from services.mock_data import DEMO_SHIPMENT_ID

router = APIRouter(tags=["shipments"])


@router.post("/shipments", response_model=Shipment)
def create_shipment(req: ShipmentCreate) -> Shipment:
    sid = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        **req.model_dump(),
        "shipment_id": sid,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "routes": [],
        "disruptions": [],
    }
    fs_service.set_doc("shipments", sid, payload)
    return Shipment(**payload)


@router.get("/shipments", response_model=List[Shipment])
def list_shipments() -> List[Shipment]:
    docs = fs_service.list_docs("shipments")
    return [Shipment(**d) for d in docs]


@router.get("/shipments/demo", response_model=Shipment)
def get_demo_shipment() -> Shipment:
    doc = fs_service.get_doc("shipments", DEMO_SHIPMENT_ID)
    if not doc:
        raise HTTPException(status_code=404, detail="Demo shipment not preloaded")
    return Shipment(**doc)


@router.get("/shipments/{shipment_id}", response_model=Shipment)
def get_shipment(shipment_id: str) -> Shipment:
    doc = fs_service.get_doc("shipments", shipment_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")
    return Shipment(**doc)
