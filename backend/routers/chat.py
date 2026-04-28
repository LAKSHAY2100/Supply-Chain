"""POST /assistant-chat -- Gemini-powered project copilot for the demo UI."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import AssistantChatRequest, AssistantChatResponse
from services import firestore as fs_service
from services import gemini

router = APIRouter(tags=["assistant"])


@router.post("/assistant-chat", response_model=AssistantChatResponse)
def assistant_chat(req: AssistantChatRequest) -> AssistantChatResponse:
    context = dict(req.context or {})
    if req.shipment_id and "shipment" not in context:
        shipment = fs_service.get_doc("shipments", req.shipment_id)
        if shipment:
            context["shipment"] = shipment

    answer, source, prompts = gemini.assistant_chat(req.question, context)
    return AssistantChatResponse(
        answer=answer,
        source=source,  # type: ignore[arg-type]
        suggested_prompts=prompts,
    )
