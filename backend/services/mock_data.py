"""Mock data generators (Faker, seeded) and demo-shipment preloader.

The preloader writes the canonical avocado Mombasa->Mumbai shipment from spec Â§7
into the active store at startup so the frontend has something to render
immediately on first load.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List

from faker import Faker

from services import firestore as fs_service

log = logging.getLogger("chainguard.mock")

DEMO_SHIPMENT_ID = "SHP-DEMO-001"

_faker = Faker()
Faker.seed(42)

CARGO_TYPES = ["avocados", "mangoes", "berries", "fish", "flowers", "vaccines"]
DISRUPTION_TYPES = [
    "port_congestion",
    "weather",
    "customs_delay",
    "mechanical",
    "strike",
]


def generate_shipment(
    origin: str | None = None,
    destination: str | None = None,
    cargo_type: str | None = None,
) -> dict:
    sid = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    return {
        "shipment_id": sid,
        "origin": origin or _faker.city() + ", " + _faker.country(),
        "destination": destination or _faker.city() + ", " + _faker.country(),
        "cargo_type": cargo_type or _faker.random_element(CARGO_TYPES),
        "weight_kg": float(_faker.random_int(500, 5000)),
        "deadline_hours": _faker.random_int(36, 96),
        "current_temp_celsius": float(_faker.random_int(4, 12)),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "routes": [],
        "disruptions": [],
    }


def generate_disruption() -> dict:
    return {
        "disruption_type": _faker.random_element(DISRUPTION_TYPES),
        "node_name": _faker.random_element(["Colombo Port", "Mombasa, Kenya", "Dubai", "Mumbai, India"]),
        "duration_hrs": float(_faker.random_int(4, 36)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def list_cargo_types() -> List[str]:
    return list(CARGO_TYPES)


def preload_demo_shipment() -> None:
    """Seed canonical avocado Kenya->India shipment if absent."""
    existing = fs_service.get_doc("shipments", DEMO_SHIPMENT_ID)
    if existing:
        log.info("Demo shipment %s already present, skipping preload.", DEMO_SHIPMENT_ID)
        return

    payload = {
        "shipment_id": DEMO_SHIPMENT_ID,
        "origin": "Mombasa, Kenya",
        "destination": "Mumbai, India",
        "cargo_type": "avocados",
        "weight_kg": 2000.0,
        "deadline_hours": 72,
        "current_temp_celsius": 9.0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "routes": [],
        "disruptions": [],
    }
    fs_service.set_doc("shipments", DEMO_SHIPMENT_ID, payload)
    log.info("Preloaded demo shipment: %s", DEMO_SHIPMENT_ID)
