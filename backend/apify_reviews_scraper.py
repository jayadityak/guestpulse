"""
apify_reviews_scraper.py — Enriches hotel data with extra Google Maps reviews via Apify.

Why Apify instead of Google Places directly?
  Google Places API returns MAX 5 reviews per hotel.
  Apify's Google Maps Scraper has no such limit — we request 15 per hotel.
  Net effect: 3× more review data for Claude to analyze, at no extra API cost.

Apify free tier: $5/month compute.
One enrichment run for 60 hotels ≈ 0.06 CU ≈ ~$0.003. Essentially free.

Actor used: compass/google-maps-scraper
  Input: searchStringsArray (hotel name + city), 1 result per search, 15 reviews each.
  All 60 hotels batched into ONE actor run for efficiency.

To activate:
  APIFY_API_TOKEN is already in backend/.env — no new key needed.

If APIFY_API_TOKEN is not set, returns hotels unchanged (graceful no-op).
"""

import asyncio
import os
import aiohttp
import time
from typing import Optional

APIFY_BASE = "https://api.apify.com/v2"
ACTOR_ID = "compass~google-maps-scraper"
MAX_REVIEWS_PER_HOTEL = 15
MAX_WAIT_SECONDS = 300  # 5 minutes max


def _api_token() -> Optional[str]:
    return os.getenv("APIFY_API_TOKEN") or None


async def _start_run(session: aiohttp.ClientSession, search_terms: list[str]) -> Optional[str]:
    """Launch one Apify actor run for all hotels. Returns run ID."""
    url = f"{APIFY_BASE}/acts/{ACTOR_ID}/runs"
    payload = {
        "searchStringsArray": search_terms,
        "maxReviews": MAX_REVIEWS_PER_HOTEL,
        "maxCrawledPlacesPerSearch": 1,  # only the top result per search term
        "reviewsSort": "newest",
        "language": "en",
        "scrapeReviews": True,
        "scrapeDirections": False,
        "scrapeOpeningHours": False,
    }
    params = {"token": _api_token()}
    try:
        async with session.post(
            url, json=payload, params=params, timeout=aiohttp.ClientTimeout(total=30)
        ) as resp:
            if resp.status not in (200, 201):
                text = await resp.text()
                print(f"[Apify] Failed to start run: {resp.status} — {text[:200]}")
                return None
            data = await resp.json()
            run_id = data.get("data", {}).get("id")
            print(f"[Apify] Run started: {run_id}")
            return run_id
    except Exception as e:
        print(f"[Apify] Start run error: {e}")
        return None


async def _wait_for_run(session: aiohttp.ClientSession, run_id: str) -> bool:
    """Poll until the run finishes (SUCCEEDED/FAILED/ABORTED). Returns True on success."""
    url = f"{APIFY_BASE}/actor-runs/{run_id}"
    params = {"token": _api_token()}
    deadline = time.time() + MAX_WAIT_SECONDS
    poll_interval = 5

    while time.time() < deadline:
        await asyncio.sleep(poll_interval)
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    continue
                data = await resp.json()
                status = data.get("data", {}).get("status", "")
                if status == "SUCCEEDED":
                    print(f"[Apify] Run {run_id} succeeded ✓")
                    return True
                if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    print(f"[Apify] Run {run_id} ended with status: {status}")
                    return False
                # Still running — increase poll interval gradually
                poll_interval = min(poll_interval + 2, 20)
        except Exception:
            pass

    print(f"[Apify] Timed out waiting for run {run_id}")
    return False


async def _fetch_results(session: aiohttp.ClientSession, run_id: str) -> list[dict]:
    """Fetch the dataset from the completed run."""
    url = f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items"
    params = {"token": _api_token(), "format": "json", "limit": 500}
    try:
        async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                return []
            return await resp.json()
    except Exception as e:
        print(f"[Apify] Fetch results error: {e}")
        return []


def _normalize_reviews(apify_place: dict) -> list[dict]:
    """Convert Apify Google Maps result → list of review dicts (same shape as google_places_scraper)."""
    reviews = []
    for r in apify_place.get("reviews", []) or []:
        text = (r.get("text") or r.get("snippet") or "").strip()
        if not text or len(text) < 20:
            continue
        reviews.append({
            "text": text[:1500],
            "rating": r.get("stars") or r.get("rating"),
            "date": (r.get("publishAt") or r.get("publishedAtDate") or "")[:10],
            "reviewer": r.get("name") or r.get("reviewerName") or "Anonymous",
            "source": "google_maps",
        })
    return reviews


async def enrich_hotels_with_apify(
    hotels_raw: list[dict],
    city: str,
) -> list[dict]:
    """
    Uses one Apify Google Maps Scraper run to fetch up to 15 reviews per hotel.
    Merges new reviews with existing ones (deduplicates by text).
    Returns the same list (mutated) with reviews extended.
    No-op if APIFY_API_TOKEN is not set.
    """
    if not _api_token():
        return hotels_raw

    print(f"\n[Apify] Enriching {len(hotels_raw)} hotels with Google Maps reviews…")

    # Build one search term per hotel: "Hotel Name, City"
    search_terms = [f"{h['name']}, {city}" for h in hotels_raw]

    async with aiohttp.ClientSession() as session:
        # 1. Start the actor run
        run_id = await _start_run(session, search_terms)
        if not run_id:
            print("[Apify] Could not start run — skipping enrichment.")
            return hotels_raw

        # 2. Wait for completion
        success = await _wait_for_run(session, run_id)
        if not success:
            print("[Apify] Run did not succeed — skipping enrichment.")
            return hotels_raw

        # 3. Fetch results
        results = await _fetch_results(session, run_id)

    if not results:
        print("[Apify] No results returned.")
        return hotels_raw

    # 4. Match Apify results back to hotels by name (fuzzy: lowercase strip)
    apify_by_name: dict[str, list[dict]] = {}
    for place in results:
        raw_name = (place.get("title") or place.get("name") or "").strip().lower()
        if raw_name:
            apify_by_name.setdefault(raw_name, []).append(place)

    added_count = 0
    for hotel in hotels_raw:
        hotel_key = hotel["name"].strip().lower()
        matches = apify_by_name.get(hotel_key, [])

        if not matches:
            # Fallback: partial match (e.g. "Hilton Madison" vs "Hilton Madison Monona Terrace")
            for key, places in apify_by_name.items():
                if hotel_key in key or key in hotel_key:
                    matches = places
                    break

        if not matches:
            continue

        new_reviews = _normalize_reviews(matches[0])
        if not new_reviews:
            continue

        # Deduplicate against existing reviews by text snippet
        existing_texts = {r["text"][:60].lower() for r in hotel.get("reviews", [])}
        unique_new = [r for r in new_reviews if r["text"][:60].lower() not in existing_texts]

        hotel["reviews"] = hotel.get("reviews", []) + unique_new
        added_count += len(unique_new)

    print(f"[Apify] Added {added_count} reviews across {len(hotels_raw)} hotels")
    return hotels_raw
