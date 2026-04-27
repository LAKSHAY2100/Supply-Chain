"""Multi-objective decision engine - implements the threshold table from spec section 4.7.

| Quality   | Risk     | Decision               |
| --------- | -------- | ---------------------- |
| > 75      | < 40     | CONTINUE               |
| 40 - 75   | any      | MONITOR                |
| any       | 60 - 80  | PREPARE_ALTERNATE      |
| < 40 OR risk > 80 | AUTO_REROUTE  |
| < 20 AND risk > 60 | EMERGENCY_REROUTE |
"""

from __future__ import annotations

from typing import Tuple


def decide(quality_score: float, risk_score: float) -> Tuple[str, str, str]:
    """Return (action, primary_factor, rationale)."""

    if quality_score < 20 and risk_score > 60:
        return (
            "EMERGENCY_REROUTE",
            "spoilage_imminent",
            f"Quality at {quality_score:.0f}% with risk {risk_score:.0f}/100 - "
            "spoilage imminent; emergency reroute and alert buyer.",
        )

    if quality_score < 40 or risk_score > 80:
        return (
            "AUTO_REROUTE",
            "critical_quality_or_risk" if quality_score < 40 else "critical_risk",
            f"Quality {quality_score:.0f}% or risk {risk_score:.0f}/100 breached "
            "critical threshold - auto-rerouting to preserve cargo value.",
        )

    if 60 <= risk_score <= 80:
        return (
            "PREPARE_ALTERNATE",
            "elevated_risk",
            f"Risk score {risk_score:.0f}/100 is elevated - staging alternate route "
            "to deploy if it crosses 80.",
        )

    if 40 <= quality_score <= 75:
        return (
            "MONITOR",
            "quality_warning",
            f"Quality at {quality_score:.0f}% sits in the warning band - continuing "
            "current route under close monitoring.",
        )

    return (
        "CONTINUE",
        "all_clear",
        f"All clear: quality {quality_score:.0f}% and risk {risk_score:.0f}/100 "
        "are within healthy thresholds - staying on the planned route.",
    )
