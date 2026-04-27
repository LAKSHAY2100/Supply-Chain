"""POST /explain -- Gemini-powered (or templated) decision explanation."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import ExplainRequest, ExplainResponse
from services import gemini

router = APIRouter(tags=["explain"])


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest) -> ExplainResponse:
    text, source, factors = gemini.explain_decision(
        route_a=req.route_a.model_dump(),
        route_b=req.route_b.model_dump() if req.route_b else None,
        decision=req.decision.action,
        primary_factor=req.decision.primary_factor,
        cargo_type=req.cargo_type,
        current_quality=req.quality.quality_score,
        disruption_desc=req.disruption_desc,
    )
    confidence = 0.92 if source == "gemini" else 0.78
    return ExplainResponse(
        explanation=text,
        confidence=confidence,
        key_factors=factors,
        source=source,  # type: ignore[arg-type]
    )
