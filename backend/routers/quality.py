"""POST /predict-quality -- perishable decay forecast."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import QualityRequest, QualityResult
from services import quality_engine

router = APIRouter(tags=["quality"])


@router.post("/predict-quality", response_model=QualityResult)
def predict_quality(req: QualityRequest) -> QualityResult:
    quality, status, loss_pct, remaining, curve, delay_impact = quality_engine.predict(
        cargo_type=req.cargo_type,
        elapsed_hours=req.elapsed_hours,
        delay_hours=req.delay_hours,
        temp_celsius=req.temp_celsius,
        initial_quality=req.initial_quality,
    )
    return QualityResult(
        cargo_type=req.cargo_type,
        quality_score=quality,
        status=status,  # type: ignore[arg-type]
        economic_loss_pct=loss_pct,
        remaining_shelf_life_hrs=remaining,
        decay_curve=curve,
        **delay_impact,
    )
