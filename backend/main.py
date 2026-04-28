"""FastAPI entry point for ChainGuard AI."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import disruption, explain, quality, risk, routing, shipments, simulate
from services import firestore as fs_service
from services import graph as graph_service
from services import mock_data, risk_engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
log = logging.getLogger("chainguard")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    log.info("Starting ChainGuard AI backend")
    log.info(
        "Capabilities | gemini=%s | gmaps=%s | weather=%s | firestore=%s",
        settings.has_gemini,
        settings.has_gmaps,
        settings.has_weather,
        settings.has_firestore,
    )

    fs_service.init_store()
    graph_service.init_graph()
    risk_engine.ensure_model_trained()
    mock_data.preload_demo_shipment()

    yield
    log.info("ChainGuard AI backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    cors_origins = settings.cors_origin_list
    allow_all_origins = "*" in cors_origins
    app = FastAPI(
        title="ChainGuard AI",
        description="AI-powered, perishable-aware supply chain intelligence (MVP).",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Allow any localhost / 127.0.0.1 origin so the Vite dev server works
    # regardless of which port it binds to (5173, 5174, ...).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all_origins else cors_origins,
        allow_origin_regex=None if allow_all_origins else r"http://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?",
        allow_credentials=False if allow_all_origins else True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(shipments.router)
    app.include_router(risk.router)
    app.include_router(quality.router)
    app.include_router(routing.router)
    app.include_router(explain.router)
    app.include_router(disruption.router)
    app.include_router(simulate.router)

    @app.get("/", tags=["meta"])
    def root():
        return {
            "service": "ChainGuard AI",
            "status": "ok",
            "docs": "/docs",
            "capabilities": {
                "gemini": settings.has_gemini,
                "gmaps": settings.has_gmaps,
                "weather": settings.has_weather,
                "firestore": settings.has_firestore,
            },
        }

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "healthy"}

    return app


app = create_app()
