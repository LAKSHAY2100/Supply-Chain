"""Google Maps wrapper with deterministic mock fallback.

Single public function: ``get_route_metrics(origin, destination, mode)`` which returns
{distance_km, duration_hrs}. When ``GOOGLE_MAPS_API_KEY`` is missing or any error
occurs, returns a pre-baked mock keyed off origin/destination.
"""

from __future__ import annotations

import logging
from typing import Dict

from config import get_settings

log = logging.getLogger("chainguard.gmaps")

_MOCK_DISTANCES: Dict[tuple, dict] = {
    ("Mombasa, Kenya", "Colombo Port"): {"distance_km": 4100, "duration_hrs": 48},
    ("Colombo Port", "Mumbai, India"): {"distance_km": 1800, "duration_hrs": 24},
    ("Mombasa, Kenya", "Dubai"): {"distance_km": 3500, "duration_hrs": 18},
    ("Dubai", "Mumbai, India"): {"distance_km": 1900, "duration_hrs": 14},
    ("Mombasa, Kenya", "Suez"): {"distance_km": 4200, "duration_hrs": 96},
    ("Suez", "Mumbai, India"): {"distance_km": 4500, "duration_hrs": 110},
    ("Mombasa, Kenya", "Mumbai, India"): {"distance_km": 4800, "duration_hrs": 60},
}


def _mock_lookup(origin: str, destination: str) -> dict:
    key = (origin, destination)
    if key in _MOCK_DISTANCES:
        return dict(_MOCK_DISTANCES[key])
    rev = (destination, origin)
    if rev in _MOCK_DISTANCES:
        return dict(_MOCK_DISTANCES[rev])
    return {"distance_km": 3500.0, "duration_hrs": 50.0}


def get_route_metrics(origin: str, destination: str, mode: str = "driving") -> dict:
    settings = get_settings()
    if not settings.has_gmaps:
        return _mock_lookup(origin, destination)

    try:
        import googlemaps  # imported lazily to avoid load cost when unused

        client = googlemaps.Client(key=settings.google_maps_api_key)
        result = client.distance_matrix(origins=[origin], destinations=[destination], mode=mode)
        element = result["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            log.warning("gmaps non-OK status, falling back: %s", element.get("status"))
            return _mock_lookup(origin, destination)
        return {
            "distance_km": element["distance"]["value"] / 1000.0,
            "duration_hrs": element["duration"]["value"] / 3600.0,
        }
    except Exception as exc:  # network / quota / parse -- degrade gracefully
        log.warning("gmaps call failed, using mock: %s", exc)
        return _mock_lookup(origin, destination)
