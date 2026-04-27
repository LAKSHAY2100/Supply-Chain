"""Pydantic v2 schemas -- single source of truth for request/response contracts."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------- Shipment ----------


class ShipmentCreate(BaseModel):
    origin: str = Field(..., examples=["Mombasa, Kenya"])
    destination: str = Field(..., examples=["Mumbai, India"])
    cargo_type: str = Field("avocados", examples=["avocados"])
    weight_kg: float = Field(2000, gt=0)
    deadline_hours: int = Field(72, gt=0)
    current_temp_celsius: float = Field(9.0)


class Waypoint(BaseModel):
    name: str
    lat: float
    lng: float


class Route(BaseModel):
    name: str
    waypoints: List[Waypoint]
    distance_km: float
    base_eta_hrs: float
    risk_factors: List[str] = []
    risk_score: float = 0.0
    delay_prob: float = 0.0
    quality_at_arrival: float = 100.0
    composite_weight: float = 0.0
    cost_usd: float = 0.0
    transport_mode: str = "sea"


class Shipment(ShipmentCreate):
    shipment_id: str
    status: str = "active"
    created_at: str
    routes: List[Route] = []
    selected_route: Optional[str] = None
    decision: Optional[str] = None
    explanation: Optional[str] = None
    disruptions: List[dict] = []


# ---------- Risk ----------


class RiskRequest(BaseModel):
    route_id: str = Field(..., examples=["route-a"])
    distance_km: float
    base_eta_hrs: float
    weather_score: float = Field(50.0, ge=0, le=100, description="0=clear, 100=severe")
    congestion_level: float = Field(50.0, ge=0, le=100)
    day_of_week: int = Field(2, ge=0, le=6)
    transport_mode: str = "sea"


class RiskResult(BaseModel):
    route_id: str
    risk_score: float
    delay_prob: float
    risk_level: Literal["low", "medium", "high"]
    factors: List[str]
    rule_score: float
    ml_score: float


# ---------- Quality ----------


class QualityRequest(BaseModel):
    cargo_type: str = "avocados"
    elapsed_hours: float = 0.0
    delay_hours: float = 0.0
    temp_celsius: float = 9.0
    initial_quality: float = 100.0


class QualityResult(BaseModel):
    cargo_type: str
    quality_score: float
    status: Literal["fresh", "acceptable", "spoiled"]
    economic_loss_pct: float
    remaining_shelf_life_hrs: float
    decay_curve: List[dict]  # [{"hour": int, "quality": float}]


# ---------- Routing ----------


class OptimizeRequest(BaseModel):
    origin: str = "Mombasa, Kenya"
    destination: str = "Mumbai, India"
    cargo_type: str = "avocados"
    deadline_hours: int = 72
    weight_kg: float = 2000
    current_temp_celsius: float = 9.0


class OptimizeResponse(BaseModel):
    shipment_id: str
    primary_route: Route
    alternative_route: Optional[Route]
    recommendation: str
    decision: str
    quality: QualityResult
    risk: RiskResult


# ---------- Decision ----------


class Decision(BaseModel):
    action: Literal[
        "CONTINUE",
        "MONITOR",
        "PREPARE_ALTERNATE",
        "AUTO_REROUTE",
        "EMERGENCY_REROUTE",
    ]
    rationale: str
    primary_factor: str


# ---------- Explain ----------


class ExplainRequest(BaseModel):
    route_a: Route
    route_b: Optional[Route] = None
    risk: RiskResult
    quality: QualityResult
    decision: Decision
    cargo_type: str = "avocados"
    disruption_desc: Optional[str] = None


class ExplainResponse(BaseModel):
    explanation: str
    confidence: float
    key_factors: List[str]
    source: Literal["gemini", "template"]


# ---------- Disruption ----------


class DisruptionRequest(BaseModel):
    shipment_id: str
    disruption_type: Literal[
        "port_congestion", "weather", "customs_delay", "mechanical", "strike"
    ] = "port_congestion"
    node_name: str = "Colombo Port"
    duration_hrs: float = 12.0


class DisruptionResponse(BaseModel):
    shipment_id: str
    disruption: dict
    updated_risk: RiskResult
    updated_quality: QualityResult
    new_decision: Decision
    new_route: Optional[Route]


# ---------- Simulate ----------


class SimulateRequest(BaseModel):
    disrupted_node_id: str = "colombo_port"
    delay_hours: float = 12.0


class SimulateResponse(BaseModel):
    affected_nodes: List[str]
    affected_shipments: int
    affected_operations: int
    estimated_total_delay_hrs: float
    economic_impact_usd: float
    narrative: str
