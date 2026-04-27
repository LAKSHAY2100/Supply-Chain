"""Two-tier risk scoring per spec §4.3: fast rule-based scorer + scikit-learn RF.

The Random Forest is trained on 500 seeded synthetic records on first run and
pickled to ``backend/models/risk_model.pkl`` for subsequent loads. Both scorers
take the same input vector; the rule-based one is always-on, the RF enriches.
"""

from __future__ import annotations

import logging
import os
from typing import List, Tuple

import joblib
import numpy as np

log = logging.getLogger("chainguard.risk")

_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "risk_model.pkl")
_SEED = 42

# Rule-based weights (per spec §4.3)
W_WEATHER = 0.35
W_TRAFFIC = 0.40
W_DISTANCE = 0.25

# Internal model handle
_model = None


# ---------- Feature engineering ----------


def _featurize(
    distance_km: float,
    base_eta_hrs: float,
    weather_score: float,
    congestion_level: float,
    day_of_week: int,
    transport_mode: str,
) -> np.ndarray:
    """12-feature vector per spec §4.3."""
    mode_idx = {"sea": 0, "air": 1, "road": 2, "multimodal": 3}.get(transport_mode, 0)
    is_weekend = 1 if day_of_week in (5, 6) else 0
    long_haul = 1 if distance_km > 3000 else 0
    weather_severe = 1 if weather_score >= 70 else 0
    return np.array(
        [
            distance_km / 1000.0,
            base_eta_hrs / 24.0,
            weather_score / 100.0,
            congestion_level / 100.0,
            day_of_week / 6.0,
            mode_idx / 3.0,
            is_weekend,
            long_haul,
            weather_severe,
            (weather_score * congestion_level) / 10000.0,  # interaction
            np.log1p(distance_km) / 10.0,
            (base_eta_hrs / max(distance_km, 1)) * 100.0,  # speed proxy
        ],
        dtype=float,
    )


# ---------- Synthetic data ----------


def _generate_training_data(n: int = 500):
    rng = np.random.default_rng(_SEED)
    X, y = [], []
    for _ in range(n):
        distance_km = float(rng.uniform(200, 6000))
        base_eta_hrs = distance_km / float(rng.uniform(20, 120))
        weather_score = float(rng.uniform(0, 100))
        congestion = float(rng.uniform(0, 100))
        dow = int(rng.integers(0, 7))
        mode = ["sea", "air", "road", "multimodal"][int(rng.integers(0, 4))]

        # Ground truth: probability of significant delay
        base = 0.05
        base += 0.40 * (weather_score / 100.0)
        base += 0.35 * (congestion / 100.0)
        base += 0.10 * (1 if distance_km > 3000 else 0)
        base += 0.05 * (1 if dow in (5, 6) else 0)
        base += 0.05 * (1 if mode == "sea" else 0)
        prob = float(np.clip(base + rng.normal(0, 0.05), 0.0, 1.0))

        X.append(_featurize(distance_km, base_eta_hrs, weather_score, congestion, dow, mode))
        y.append(1 if prob > 0.5 else 0)
    return np.array(X), np.array(y)


# ---------- Train / load ----------


def ensure_model_trained() -> None:
    """Load pickled RF if present, else train on 500 synthetic rows and persist."""
    global _model
    os.makedirs(os.path.dirname(_MODEL_PATH), exist_ok=True)
    if os.path.exists(_MODEL_PATH):
        try:
            _model = joblib.load(_MODEL_PATH)
            log.info("Loaded RF model from %s", _MODEL_PATH)
            return
        except Exception as exc:
            log.warning("Failed loading RF model, retraining: %s", exc)

    from sklearn.ensemble import RandomForestClassifier

    X, y = _generate_training_data(500)
    rf = RandomForestClassifier(
        n_estimators=80, max_depth=8, random_state=_SEED, n_jobs=-1
    )
    rf.fit(X, y)
    joblib.dump(rf, _MODEL_PATH)
    _model = rf
    log.info("Trained RF model (500 synthetic rows) and saved to %s", _MODEL_PATH)


# ---------- Scoring ----------


def rule_based_score(
    distance_km: float, weather_score: float, congestion_level: float
) -> float:
    normalized_distance = min(distance_km / 6000.0, 1.0) * 100.0
    return (
        W_WEATHER * weather_score
        + W_TRAFFIC * congestion_level
        + W_DISTANCE * normalized_distance
    )


def ml_delay_probability(
    distance_km: float,
    base_eta_hrs: float,
    weather_score: float,
    congestion_level: float,
    day_of_week: int,
    transport_mode: str,
) -> float:
    if _model is None:
        ensure_model_trained()
    features = _featurize(
        distance_km, base_eta_hrs, weather_score, congestion_level, day_of_week, transport_mode
    ).reshape(1, -1)
    proba = _model.predict_proba(features)[0]
    # P(class==1) when binary classifier
    if len(proba) == 2:
        return float(proba[1])
    return float(proba[0])


def score(
    distance_km: float,
    base_eta_hrs: float,
    weather_score: float,
    congestion_level: float,
    day_of_week: int = 2,
    transport_mode: str = "sea",
) -> Tuple[float, float, float, str, List[str]]:
    """Return (final_risk_score, delay_prob, rule_score, level, factor_list)."""
    rule = rule_based_score(distance_km, weather_score, congestion_level)
    ml_prob = ml_delay_probability(
        distance_km, base_eta_hrs, weather_score, congestion_level, day_of_week, transport_mode
    )

    # Final blend: 60% rule (interpretable) + 40% ML scaled to 0-100
    final = round(0.6 * rule + 0.4 * (ml_prob * 100.0), 2)

    level = "low"
    if final >= 70:
        level = "high"
    elif final >= 40:
        level = "medium"

    factors: List[str] = []
    if weather_score >= 60:
        factors.append("severe_weather")
    if congestion_level >= 60:
        factors.append("high_congestion")
    if distance_km >= 4000:
        factors.append("long_haul")
    if day_of_week in (5, 6):
        factors.append("weekend_handling")
    if not factors:
        factors.append("nominal_conditions")

    return final, round(ml_prob, 3), round(rule, 2), level, factors
