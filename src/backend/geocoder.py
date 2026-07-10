import os
import json
import urllib.request
import urllib.parse

OPENWEATHER_API_KEY = os.environ["OPENWEATHER_API_KEY"]
GEO_BASE = "http://api.openweathermap.org/geo/1.0"


def get_coordinates_from_zipcode(zipcode: str) -> tuple[float, float]:
    """Resolve a location ID to (lat, lon).

    Accepts two formats:
    - German PLZ (digits only, e.g. "90403"): calls OpenWeather zip geocoding with ,DE
    - lat/lon ID (e.g. "22.3_70.8"): parsed directly, no API call needed
    """
    if "_" in zipcode:
        parts = zipcode.split("_", 1)
        return float(parts[0]), float(parts[1])
    url = f"{GEO_BASE}/zip?zip={zipcode},DE&appid={OPENWEATHER_API_KEY}"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    return data["lat"], data["lon"]


def get_coordinates_from_city(city_name: str) -> tuple[float | None, float | None]:
    """Resolve a city name to (lat, lon) using OpenWeather geocoding."""
    url = f"{GEO_BASE}/direct?q={urllib.parse.quote(city_name)}&limit=1&appid={OPENWEATHER_API_KEY}"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    if not data:
        return None, None
    return data[0]["lat"], data[0]["lon"]


def search_cities(query: str, limit: int = 8) -> list[dict]:
    """Search cities worldwide using OpenWeather geocoding API.

    Returns a list of dicts with: name, country, state, lat, lon, id.
    The id is "lat_lon" rounded to 4dp — used as the location key in MongoDB.
    """
    url = f"{GEO_BASE}/direct?q={urllib.parse.quote(query.strip())}&limit={limit}&appid={OPENWEATHER_API_KEY}"
    with urllib.request.urlopen(url) as resp:
        results = json.load(resp)

    out = []
    seen_ids: set[str] = set()
    for r in results:
        lat = round(r["lat"], 4)
        lon = round(r["lon"], 4)
        loc_id = f"{lat}_{lon}"
        if loc_id in seen_ids:
            continue
        seen_ids.add(loc_id)
        # Prefer English local name when available
        local_names = r.get("local_names") or {}
        name = local_names.get("en") or r["name"]
        out.append({
            "name":    name,
            "country": r.get("country", ""),
            "state":   r.get("state", ""),
            "lat":     lat,
            "lon":     lon,
            "id":      loc_id,
        })
    return out
