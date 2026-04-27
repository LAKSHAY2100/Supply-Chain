"""POST /predict-risk -- rule-based + RF blended risk score."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import RiskRequest, RiskResult
from services import risk_engine

router = APIRouter(tags=["risk"])


@router.post("/predict-risk", response_model=RiskResult)
def predict_risk(req: RiskRequest) -> RiskResult:
    final, delay_prob, rule_score, level, factors = risk_engine.score(
        distance_km=req.distance_km,
        base_eta_hrs=req.base_eta_hrs,
        weather_score=req.weather_score,
        congestion_level=req.congestion_level,
        day_of_week=req.day_of_week,
        transport_mode=req.transport_mode,
    )
    return RiskResult(
        route_id=req.route_id,
        risk_score=final,
        delay_prob=delay_prob,
        risk_level=level,  # type: ignore[arg-type]
        factors=factors,
        rule_score=rule_score,
        ml_score=delay_prob * 100.0,
    )
