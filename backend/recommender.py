"""
NLP-driven hotel recommender for Madison, WI.

Two modes:
- recommend()          : single Claude call, returns full ranked list (blocking)
- stream_recommendations(): yields SSE events — hotels immediately via heuristic,
                            then Claude Haiku streams why_it_fits one by one
"""

import os
import json
import re
from typing import AsyncGenerator

MADISON_CONTEXT = """
Madison, Wisconsin landmarks:
- Kohl Center: Badgers basketball/hockey, UW campus
- Camp Randall: Badgers football, UW campus
- Monona Terrace: Convention center, downtown lakefront
- State Street: bars/restaurants, connects UW to Capitol Square
- Capitol Square: Downtown, State Capitol building
- UW-Madison Campus: West/central Madison
"""

# ── Async Anthropic client (lazy) ─────────────────────────────────────────────

_async_client = None

def _get_async_client():
    global _async_client
    if _async_client is None:
        from anthropic import AsyncAnthropic
        _async_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _async_client


# ── Hotel serialisation ───────────────────────────────────────────────────────

def _serialize_hotel(hotel) -> dict:
    """Compact profile for Claude prompts."""
    return {
        "id": hotel.id,
        "name": hotel.name,
        "address": hotel.address or "",
        "price_range": hotel.price_range or "unknown",
        "photo_url": hotel.photo_url or "",
        "avg_rating": round(hotel.avg_rating, 1) if hotel.avg_rating else None,
        "total_reviews": hotel.total_reviews or 0,
        "scores": {
            "overall":     round(hotel.overall_score,     1) if hotel.overall_score     else None,
            "cleanliness": round(hotel.cleanliness_score, 1) if hotel.cleanliness_score else None,
            "service":     round(hotel.service_score,     1) if hotel.service_score     else None,
            "food":        round(hotel.food_score,        1) if hotel.food_score        else None,
            "value":       round(hotel.value_score,       1) if hotel.value_score       else None,
            "maintenance": round(hotel.maintenance_score, 1) if hotel.maintenance_score else None,
        },
        "best_for": hotel.best_for or [],
        "summary": (hotel.ai_summary or "")[:150],
    }


# ── Heuristic ranking (instant, ~1ms) ─────────────────────────────────────────

def _heuristic_rank(query: str, hotels: list) -> list:
    """
    Keyword-weighted ranking using pre-stored dimension scores.
    Returns hotels sorted best→worst with no API call.
    """
    q = query.lower()

    # Extract budget ceiling  ($NNN)
    budget_m = re.search(r"\$(\d+)", q)
    max_budget = int(budget_m.group(1)) if budget_m else None

    # Signal detection
    want_budget  = any(w in q for w in ["budget","cheap","affordable","inexpensive","save","under $"])
    want_luxury  = any(w in q for w in ["luxury","upscale","nice","fancy","high-end","splurge"])
    want_clean   = any(w in q for w in ["clean","spotless","cleanliness"])
    want_quiet   = any(w in q for w in ["quiet","peaceful","noise","sleep","rest"])
    want_service = any(w in q for w in ["service","staff","friendly","helpful","attentive"])
    want_food    = any(w in q for w in ["breakfast","food","restaurant","dining","eat"])
    want_biz     = any(w in q for w in ["conference","business","meeting","monona","wifi","work","convention"])
    want_gameday = any(w in q for w in ["badger","game","football","basketball","kohl","randall","sports"])
    want_romance = any(w in q for w in ["romantic","couple","anniversary","honeymoon","date"])
    want_family  = any(w in q for w in ["family","kids","children","parking"])
    want_campus  = any(w in q for w in ["campus","uw","university","student","parents"])

    def _s(val):
        return val if val is not None else 5.0

    def score(h) -> float:
        s = _s(h.overall_score)

        if want_budget:   s += _s(h.value_score)        * 0.4
        if want_luxury:   s += _s(h.service_score)      * 0.3
        if want_clean:    s += _s(h.cleanliness_score)  * 0.3
        if want_quiet:    s += _s(h.maintenance_score)  * 0.3
        if want_service:  s += _s(h.service_score)      * 0.3
        if want_food:     s += _s(h.food_score)         * 0.3
        if want_biz:      s += (_s(h.service_score) + _s(h.maintenance_score)) * 0.2
        if want_gameday:  s += _s(h.value_score)        * 0.2
        if want_romance:  s += (_s(h.food_score) + _s(h.cleanliness_score)) * 0.15
        if want_family:   s += _s(h.cleanliness_score)  * 0.2
        if want_campus:   s += _s(h.value_score)        * 0.15

        # best_for tag bonus
        tags = {t.lower() for t in (h.best_for or [])}
        if want_biz     and tags & {"business","work"}:           s += 1.0
        if want_romance and tags & {"romance","couples","couple"}: s += 1.0
        if want_family  and tags & {"families","family"}:         s += 1.0
        if want_budget  and "budget" in tags:                     s += 1.0
        if want_luxury  and "luxury" in tags:                     s += 1.0
        if want_gameday and tags & {"groups","solo"}:             s += 0.5

        return s

    return sorted(hotels, key=score, reverse=True)


# ── Streaming recommendations ─────────────────────────────────────────────────

async def stream_recommendations(
    query: str,
    hotels: list,
) -> AsyncGenerator[dict, None]:
    """
    Async generator yielding SSE event dicts:

    1. {"type": "hotels", "hotels": [...heuristic-ranked HotelOut-shaped dicts]}  (~150ms)
    2. {"type": "explanation", "hotel_id": N, "rank": N, "match_score": N, "why_it_fits": "..."}  (one per hotel as Claude streams)
    3. {"type": "done"}
    """
    if not hotels:
        yield {"type": "done"}
        return

    # Stage 1 — heuristic ranking, yield immediately
    ranked = _heuristic_rank(query, hotels)
    hotel_dicts = [_serialize_hotel(h) for h in ranked]
    yield {"type": "hotels", "hotels": hotel_dicts}

    # Stage 2 — Claude Haiku generates explanations, NDJSON format
    compact_profiles = json.dumps([
        {
            "id": h["id"],
            "name": h["name"],
            "scores": h["scores"],
            "best_for": h["best_for"],
            "summary": h["summary"],
        }
        for h in hotel_dicts
    ], separators=(",", ":"))

    prompt = f"""{MADISON_CONTEXT}

Guest request: "{query}"

Hotel profiles (scores 1-10): {compact_profiles}

Output EXACTLY ONE JSON object per line (NDJSON). No outer array. No markdown. No prose.
Each line must be a complete, valid JSON object:
{{"hotel_id": <int>, "rank": <int 1-{len(hotels)}>, "match_score": <0-100>, "why_it_fits": "<1 sentence tailored to the guest's specific request>"}}

Rank all {len(hotels)} hotels. Output them in order from best fit (rank 1) to worst."""

    client = _get_async_client()
    buffer = ""

    async with client.messages.stream(
        model="claude-haiku-4-5",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            buffer += text
            # Split on newlines; keep last (potentially incomplete) line in buffer
            lines = buffer.split("\n")
            buffer = lines[-1]
            for line in lines[:-1]:
                line = line.strip()
                if line.startswith("{"):
                    try:
                        obj = json.loads(line)
                        if "hotel_id" in obj:
                            yield {"type": "explanation", **obj}
                    except json.JSONDecodeError:
                        pass

    # Drain any remaining buffer
    if buffer.strip().startswith("{"):
        try:
            obj = json.loads(buffer.strip())
            if "hotel_id" in obj:
                yield {"type": "explanation", **obj}
        except json.JSONDecodeError:
            pass

    yield {"type": "done"}


# ── Blocking recommend() — kept for /recommend endpoint ──────────────────────

async def recommend(query: str, hotels: list) -> list[dict]:
    """
    Non-streaming fallback. Uses heuristic rank + Haiku for why_it_fits.
    Returns list of { hotel_id, rank, match_score, why_it_fits }.
    """
    if not hotels:
        return []

    ranked = _heuristic_rank(query, hotels)
    hotel_dicts = [_serialize_hotel(h) for h in ranked]

    compact_profiles = json.dumps([
        {"id": h["id"], "name": h["name"], "scores": h["scores"],
         "best_for": h["best_for"], "summary": h["summary"]}
        for h in hotel_dicts
    ], separators=(",", ":"))

    prompt = f"""{MADISON_CONTEXT}

Guest request: "{query}"

Hotel profiles (scores 1-10): {compact_profiles}

Return a JSON array ranking all {len(hotels)} hotels:
[{{"hotel_id": <int>, "rank": <int>, "match_score": <0-100>, "why_it_fits": "<1 sentence>"}}]

No markdown, no prose."""

    client = _get_async_client()
    response = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    results: list[dict] = json.loads(raw)
    results.sort(key=lambda x: x.get("rank", 999))
    return results
