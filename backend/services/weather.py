"""OpenWeatherMap wrapper with deterministic mock fallback."""

from __future__ import annotations

import logging
from typing import Dict

from config import get_settings

log = logging.getLogger("chainguard.weather")

_MOCK_WEATHER: Dict[str, dict] = {
    "Mombasa, Kenya": {"condition": "humid", "wind_kph": 18, "visibility_km": 9, "score": 35},
    "Colombo Port": {"condition": "monsoon", "wind_kph": 42, "visibility_km": 4, "score": 78},
    "Dubai": {"condition": "clear", "wind_kph": 12, "visibility_km": 15, "score": 12},
    "Suez": {"condition": "windy", "wind_kph": 30, "visibility_km": 8, "score": 45},
    "Mumbai, India": {"condition": "rain", "wind_kph": 22, "visibility_km": 6, "score": 55},
}


def _mock_lookup(location: str) -> dict:
    if location in _MOCK_WEATHER:
        return dict(_MOCK_WEATHER[location])
    return {"condition": "fair", "wind_kph": 15, "visibility_km": 10, "score": 40}


def get_weather(location: str) -> dict:
    """Return {condition, wind_kph, visibility_km, score(0-100)} for a named location."""
    settings = get_settings()
    if not settings.has_weather:
        return _mock_lookup(location)

    try:
        import requests

        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": location, "appid": settings.openweather_api_key, "units": "metric"}
        r = requests.get(url, params=params, timeout=5)
        r.raise_for_status()
        data = r.json()
        wind_kph = (data.get("wind", {}).get("speed", 5)) * 3.6
        visibility_km = data.get("visibility", 10000) / 1000
        weather_main = (data.get("weather", [{}])[0]).get("main", "Clear").lower()

        score = 10
        if weather_main in {"thunderstorm", "tornado"}:
            score = 90
        elif weather_main in {"rain", "snow"}:
            score = 65
        elif weather_main in {"drizzle", "mist", "fog", "haze"}:
            score = 45
        elif weather_main in {"clouds"}:
            score = 25

        return {
            "condition": weather_main,
            "wind_kph": round(wind_kph, 1),
            "visibility_km": round(visibility_km, 1),
            "score": min(100, score + max(0, wind_kph - 30)),
        }
    except Exception as exc:
        log.warning("weather call failed, using mock: %s", exc)
        return _mock_lookup(location)
