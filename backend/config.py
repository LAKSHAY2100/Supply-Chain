"""Application settings loaded from environment / .env file."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    gemini_api_key: str = ""
    google_maps_api_key: str = ""
    openweather_api_key: str = ""
    firestore_sa_json: str = ""
    # Dev-friendly default to prevent local preflight failures across
    # localhost, LAN IPs, and varying Vite ports.
    cors_origins: str = "*"

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def has_gmaps(self) -> bool:
        return bool(self.google_maps_api_key.strip())

    @property
    def has_weather(self) -> bool:
        return bool(self.openweather_api_key.strip())

    @property
    def has_firestore(self) -> bool:
        return bool(self.firestore_sa_json.strip()) and os.path.exists(
            self.firestore_sa_json.strip()
        )

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
