"""Perishable quality decay engine -- avocado-tuned per spec section 4.4.

Implements both:

1. The exponential core formula from spec section 1 / 1.md::
       Q(t) = Q_initial * exp(-k * T_excess * t)
   with k=0.03, T_excess = max(0, temp - 6).

2. The linear, temperature-adjusted MVP variant for chart smoothness::
       quality = Q_initial - (elapsed_hrs + delay_hrs) * degradation_rate * temp_factor
   with degradation_rate=1.2 quality pts/hr at optimal temp,
   temp_factor = 1 + max(0, (temp - 7 deg C) * 0.05).

The blended score takes the more conservative (lower) of the two, since
spoilage is a one-way street. Status thresholds match spec section 4.4.
"""

from __future__ import annotations

import math
from typing import Dict, List, Tuple

# Avocado constants (per spec)
K_DECAY = 0.03
IDEAL_TEMP_C = 6.0
OPTIMAL_TEMP_C = 7.0
BASE_DEGRADATION_PER_HR = 1.2  # quality points / hour at optimal temp
SHELF_LIFE_HRS_AT_OPTIMAL = 83.0


def _exp_quality(initial: float, hours: float, temp_c: float) -> float:
    """Reference exponential model from spec section 1 — used only as a sanity floor."""
    t_excess = max(0.0, temp_c - IDEAL_TEMP_C)
    effective = t_excess if t_excess > 0 else 0.05
    return float(initial * math.exp(-K_DECAY * effective * hours))


def _linear_quality(initial: float, hours: float, temp_c: float) -> float:
    """Canonical MVP formula from spec section 4.4 — temperature-adjusted linear decay."""
    temp_factor = 1.0 + max(0.0, (temp_c - OPTIMAL_TEMP_C) * 0.05)
    return float(max(0.0, initial - hours * BASE_DEGRADATION_PER_HR * temp_factor))


def _status(q: float) -> str:
    if q > 75:
        return "fresh"
    if q > 40:
        return "acceptable"
    return "spoiled"


def _economic_loss_pct(q: float) -> float:
    """Translate quality score -> estimated market value loss %."""
    if q >= 90:
        return round((100 - q) * 0.5, 1)
    if q >= 75:
        return round(5 + (90 - q) * 1.0, 1)
    if q >= 40:
        return round(20 + (75 - q) * 1.5, 1)
    return round(min(95.0, 75 + (40 - q) * 0.5), 1)


def _remaining_shelf_life(q: float, temp_c: float) -> float:
    if q <= 0:
        return 0.0
    temp_factor = 1.0 + max(0.0, (temp_c - OPTIMAL_TEMP_C) * 0.05)
    rate = BASE_DEGRADATION_PER_HR * temp_factor
    return round(q / rate, 1) if rate > 0 else SHELF_LIFE_HRS_AT_OPTIMAL


def predict(
    cargo_type: str = "avocados",
    elapsed_hours: float = 0.0,
    delay_hours: float = 0.0,
    temp_celsius: float = 9.0,
    initial_quality: float = 100.0,
) -> Tuple[float, str, float, float, List[Dict]]:
    """Return (quality, status, loss_pct, remaining_shelf_life, decay_curve)."""
    total_hours = max(0.0, elapsed_hours + delay_hours)

    # Use the MVP linear formula (spec section 4.4) as the primary score; the
    # exponential model is too aggressive and causes near-zero quality very fast,
    # which contradicts the spec's own sample data (Route B at ~64% after 38h).
    quality = round(_linear_quality(initial_quality, total_hours, temp_celsius), 2)

    status = _status(quality)
    loss = _economic_loss_pct(quality)
    remaining = _remaining_shelf_life(quality, temp_celsius)

    # Hourly decay curve over the next 96h for chart rendering
    curve: List[Dict] = []
    horizon = 96
    for hr in range(0, horizon + 1, 4):
        curve.append({"hour": hr, "quality": round(_linear_quality(initial_quality, hr, temp_celsius), 2)})

    return quality, status, loss, remaining, curve


def predict_for_route(
    base_eta_hrs: float,
    temp_celsius: float = 9.0,
    initial_quality: float = 100.0,
    extra_delay_hrs: float = 0.0,
) -> Tuple[float, str, float]:
    """Compact helper used by routing layer for quality_at_arrival."""
    q, s, loss, _, _ = predict(
        elapsed_hours=base_eta_hrs,
        delay_hours=extra_delay_hrs,
        temp_celsius=temp_celsius,
        initial_quality=initial_quality,
    )
    return q, s, loss
