import os
import urllib.request
import json

OPENWEATHER_API_KEY = os.environ["OPENWEATHER_API_KEY"]
GEO_BASE = "http://api.openweathermap.org/geo/1.0"


def get_coordinates_from_zipcode(zipcode: str) -> tuple[float, float]:
    """Resolve a German postal code to (lat, lon) using OpenWeather geocoding."""
    url = f"{GEO_BASE}/zip?zip={zipcode},DE&appid={OPENWEATHER_API_KEY}"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    return data["lat"], data["lon"]


def get_coordinates_from_city(city_name: str) -> tuple[float, float]:
    """Resolve a German city name to (lat, lon) using OpenWeather geocoding."""
    url = f"{GEO_BASE}/direct?q={city_name},DE&limit=1&appid={OPENWEATHER_API_KEY}"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    if not data:
        return None, None
    return data[0]["lat"], data[0]["lon"]
