"""
yelp_scraper.py — Enriches hotel review data with Yelp reviews.

Yelp Fusion API (free tier):
  - 500 API calls / day
  - Up to 3 reviews per business
  - Combined with Google's 5 → 8 reviews per hotel total

To activate:
  1. Get a free key at https://www.yelp.com/developers/v3/manage_app
  2. Add YELP_API_KEY=your_key to backend/.env
  3. Nothing else to change — the pipeline picks it up automatically.

If YELP_API_KEY is not set, this module returns empty lists silently.
"""

import asyncio
import os
import aiohttp
from typing import Optional

YELP_BASE = "https://api.yelp.com/v3"


def _api_key() -> Optional[str]:
    return os.getenv("YELP_API_KEY") or None


def _headers() -> dict:
    return {"Authorization": f"Bearer {_api_key()}"}


async def _find_business(
    session: aiohttp.ClientSession,
    hotel_name: str,
    city: str,
) -> Optional[str]:
    """Search Yelp for the hotel and return its Yelp business ID."""
    url = f"{YELP_BASE}/businesses/search"
    params = {
        "term": hotel_name,
        "location": city,
        "categories": "hotels",
        "limit": 1,
    }
    try:
        async with session.get(
            url, params=params, headers=_headers(), timeout=aiohttp.ClientTimeout(total=8)
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
            businesses = data.get("businesses", [])
            if not businesses:
                return None
            return businesses[0]["id"]
    except Exception:
        return None


async def _get_reviews(
    session: aiohttp.ClientSession,
    yelp_id: str,
) -> list[dict]:
    """Fetch up to 3 reviews for a Yelp business ID."""
    url = f"{YELP_BASE}/businesses/{yelp_id}/reviews"
    params = {"limit": 3, "sort_by": "newest"}
    try:
        async with session.get(
            url, params=params, headers=_headers(), timeout=aiohttp.ClientTimeout(total=8)
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            reviews = []
            for r in data.get("reviews", []):
                text = r.get("text", "").strip()
                if not text or len(text) < 20:
                    continue
                reviews.append({
                    "text": text[:1000],
                    "rating": r.get("rating"),
                    "date": r.get("time_created", "")[:10],
                    "reviewer": r.get("user", {}).get("name", "Anonymous"),
                    "source": "yelp",
                })
            return reviews
    except Exception:
        return []


async def fetch_hotel_reviews(
    hotel_name: str,
    city: str,
    session: Optional[aiohttp.ClientSession] = None,
) -> list[dict]:
    """
    Return up to 3 Yelp reviews for a hotel.
    Returns [] immediately if YELP_API_KEY is not set.
    """
    if not _api_key():
        return []

    own_session = session is None
    if own_session:
        session = aiohttp.ClientSession()

    try:
        yelp_id = await _find_business(session, hotel_name, city)
        if not yelp_id:
            return []
        return await _get_reviews(session, yelp_id)
    finally:
        if own_session:
            await session.close()


async def enrich_hotels_with_yelp(
    hotels_raw: list[dict],
    city: str,
) -> list[dict]:
    """
    Adds Yelp reviews to each hotel dict in-place.
    Runs all lookups in parallel. No-op if YELP_API_KEY is not set.

    Returns the same list (mutated) with reviews extended.
    """
    if not _api_key():
        return hotels_raw

    print(f"\n[Yelp] Enriching {len(hotels_raw)} hotels with Yelp reviews…")

    async with aiohttp.ClientSession() as session:
        tasks = [
            fetch_hotel_reviews(h["name"], city, session)
            for h in hotels_raw
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    yelp_count = 0
    for hotel, yelp_reviews in zip(hotels_raw, results):
        if isinstance(yelp_reviews, list) and yelp_reviews:
            hotel["reviews"] = hotel.get("reviews", []) + yelp_reviews
            yelp_count += len(yelp_reviews)

    print(f"[Yelp] Added {yelp_count} reviews across {len(hotels_raw)} hotels")
    return hotels_raw
