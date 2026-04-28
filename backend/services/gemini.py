"""Gemini Pro client + 4 prompt templates with deterministic template fallbacks.

If ``GEMINI_API_KEY`` is set, calls the real Gemini Pro API. Otherwise returns
hand-crafted f-strings that read like Gemini output, so the demo UI is unaffected.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from config import get_settings

log = logging.getLogger("chainguard.gemini")

_MODEL_NAME = "gemini-1.5-flash"


# ---------- Prompt templates (per spec section 6.2) ----------

DECISION_PROMPT = """You are a supply chain intelligence system. Explain the following routing decision to a logistics manager in 3-4 clear sentences. Be specific about numbers.

Route A: {route_a_name} | ETA: {route_a_eta}h | Risk: {route_a_risk}/100 | Quality at arrival: {route_a_quality}%
Route B: {route_b_name} | ETA: {route_b_eta}h | Risk: {route_b_risk}/100 | Quality at arrival: {route_b_quality}%
Decision: {decision} | Reason: {primary_factor}
Cargo: {cargo_type} | Current quality: {current_quality}% | Disruption: {disruption_desc}

Explain the decision, what was sacrificed, and what was preserved."""

QUALITY_PROMPT = """You are a perishable goods expert. Translate this quality data into a business impact statement for a produce buyer.

Cargo: {cargo_type} ({weight_kg}kg) from {origin} to {destination}
Current quality: {quality_score}% | Status: {status}
Delay added: {delay_hours}h | Estimated value loss: {loss_pct}%

In 2-3 sentences: describe the quality risk, estimated market value impact, and recommended action."""

IMPACT_PROMPT = """Explain the supply chain cascade impact of this disruption to a logistics director. Be concise and action-oriented.

Disruption: {disruption_type} at {node_name} | Duration: {delay_hours}h
Affected nodes: {affected_nodes} | Downstream shipments impacted: {shipment_count}
Estimated total delay across network: {total_delay_hrs}h | Economic exposure: ${economic_value}

Provide: (1) What happened (2) What will be affected (3) Recommended immediate action."""

CHAT_PROMPT = """You are ChainGuard AI, a Google-first supply chain copilot for a hackathon demo.
Answer the user's question using the shipment context below.

Rules:
- Be concise, helpful, and confident.
- Prefer Google ecosystem framing when relevant: Gemini, Google Maps, Firestore, Cloud Run, Firebase Hosting, Vertex AI.
- If the context is missing, say what is unavailable instead of inventing.
- When asked about decisions, explain risk, quality, disruption impact, and route tradeoffs.

Shipment context:
{context}

User question:
{question}

Answer in 4-8 sentences max."""


# ---------- Gemini call wrapper ----------


def _generate(prompt: str) -> Optional[str]:
    settings = get_settings()
    if not settings.has_gemini:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(_MODEL_NAME)
        response = model.generate_content(prompt)
        return (response.text or "").strip() or None
    except Exception as exc:
        log.warning("gemini call failed, using template fallback: %s", exc)
        return None


# ---------- Public API ----------


def explain_decision(
    route_a: dict,
    route_b: Optional[dict],
    decision: str,
    primary_factor: str,
    cargo_type: str,
    current_quality: float,
    disruption_desc: Optional[str] = None,
) -> Tuple[str, str, List[str]]:
    """Return (text, source, key_factors). source ∈ {"gemini","template"}."""

    rb = route_b or {
        "name": "n/a",
        "base_eta_hrs": 0,
        "risk_score": 0,
        "quality_at_arrival": 0,
    }

    prompt = DECISION_PROMPT.format(
        route_a_name=route_a.get("name"),
        route_a_eta=round(route_a.get("base_eta_hrs", 0), 1),
        route_a_risk=round(route_a.get("risk_score", 0), 1),
        route_a_quality=round(route_a.get("quality_at_arrival", 0), 1),
        route_b_name=rb.get("name"),
        route_b_eta=round(rb.get("base_eta_hrs", 0), 1),
        route_b_risk=round(rb.get("risk_score", 0), 1),
        route_b_quality=round(rb.get("quality_at_arrival", 0), 1),
        decision=decision,
        primary_factor=primary_factor,
        cargo_type=cargo_type,
        current_quality=round(current_quality, 1),
        disruption_desc=disruption_desc or "none",
    )

    text = _generate(prompt)
    factors = [primary_factor, "quality preservation", "risk mitigation"]
    if text:
        return text, "gemini", factors

    # Deterministic template fallback that reads like a Gemini response.
    chosen = (
        rb if decision in {"AUTO_REROUTE", "EMERGENCY_REROUTE"} and route_b else route_a
    )
    other = route_a if chosen is rb else rb
    text = (
        f"Recommendation: select {chosen.get('name')}. "
        f"It arrives in {chosen.get('base_eta_hrs', 0):.1f}h with a risk score of "
        f"{chosen.get('risk_score', 0):.0f}/100 and projected {cargo_type} quality of "
        f"{chosen.get('quality_at_arrival', 0):.0f}% at arrival, versus "
        f"{other.get('name')} which would land at "
        f"{other.get('quality_at_arrival', 0):.0f}% quality after "
        f"{other.get('base_eta_hrs', 0):.1f}h. "
        f"The system prioritised {primary_factor} given the current cargo state "
        f"({current_quality:.0f}% quality)"
        + (f" and disruption: {disruption_desc}." if disruption_desc else ".")
    )
    return text, "template", factors


def explain_quality(
    cargo_type: str,
    weight_kg: float,
    origin: str,
    destination: str,
    quality_score: float,
    status: str,
    delay_hours: float,
    loss_pct: float,
) -> str:
    prompt = QUALITY_PROMPT.format(
        cargo_type=cargo_type,
        weight_kg=weight_kg,
        origin=origin,
        destination=destination,
        quality_score=round(quality_score, 1),
        status=status,
        delay_hours=round(delay_hours, 1),
        loss_pct=round(loss_pct, 1),
    )
    text = _generate(prompt)
    if text:
        return text
    return (
        f"At {quality_score:.0f}% quality the {weight_kg:.0f}kg of {cargo_type} from "
        f"{origin} to {destination} are currently classified as '{status}'. "
        f"With {delay_hours:.1f}h of added delay, projected value loss is ~{loss_pct:.0f}% "
        f"of cargo worth. Recommended action: prioritise faster cold-chain alternative."
    )


def explain_impact(
    disruption_type: str,
    node_name: str,
    delay_hours: float,
    affected_nodes: List[str],
    shipment_count: int,
    total_delay_hrs: float,
    economic_value: float,
) -> str:
    prompt = IMPACT_PROMPT.format(
        disruption_type=disruption_type,
        node_name=node_name,
        delay_hours=round(delay_hours, 1),
        affected_nodes=", ".join(affected_nodes),
        shipment_count=shipment_count,
        total_delay_hrs=round(total_delay_hrs, 1),
        economic_value=round(economic_value, 0),
    )
    text = _generate(prompt)
    if text:
        return text
    return (
        f"(1) {disruption_type.replace('_', ' ').title()} at {node_name} of "
        f"{delay_hours:.0f}h. "
        f"(2) {shipment_count} downstream shipment(s) affected across "
        f"{', '.join(affected_nodes) or 'no further nodes'} with cumulative "
        f"{total_delay_hrs:.0f}h of delay and ~${economic_value:,.0f} of exposure. "
        f"(3) Re-route impacted shipments via the fastest cold-chain alternative and "
        f"notify downstream operations immediately."
    )


def assistant_chat(question: str, context: dict | None = None) -> Tuple[str, str, List[str]]:
    ctx = context or {}
    prompt = CHAT_PROMPT.format(context=ctx, question=question.strip())
    text = _generate(prompt)
    suggested = [
        "Why did the route change after disruption?",
        "How does Gemini help in this workflow?",
        "Which Google Cloud services are used here?",
    ]
    if text:
        return text, "gemini", suggested

    route = ctx.get("primary_route") or {}
    risk = ctx.get("risk") or {}
    quality = ctx.get("quality") or {}
    decision = ctx.get("decision") or "No decision yet"
    disruptions = ctx.get("disruptions") or []
    google_stack = ", ".join(
        name
        for name, enabled in {
            "Gemini": bool((ctx.get("capabilities") or {}).get("gemini")),
            "Google Maps": bool((ctx.get("capabilities") or {}).get("gmaps")),
            "Firestore": bool((ctx.get("capabilities") or {}).get("firestore")),
        }.items()
        if enabled
    ) or "mock-friendly Google integrations"
    disruption_text = (
        f"The latest disruption is {disruptions[-1].get('disruption_type')} at {disruptions[-1].get('node_name')}."
        if disruptions
        else "No active disruption is recorded in the current snapshot."
    )
    answer = (
        f"ChainGuard is currently recommending {decision} on {route.get('name', 'the active route')}. "
        f"Risk is {risk.get('risk_score', 0):.0f}/100 with projected arrival quality at "
        f"{quality.get('quality_score', route.get('quality_at_arrival', 0)):.0f}%. "
        f"{disruption_text} "
        f"For the demo, the strongest Google story is the use of {google_stack}, plus Cloud Run and Firebase Hosting for deployment. "
        f"If you ask about a specific screen or decision, I can explain that part in business terms."
    )
    return answer, "template", suggested
