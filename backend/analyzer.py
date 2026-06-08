"""
Claude-powered NLP for hotel review intelligence.

Two passes:
1. Per-review  → sentiment, categories, complaints, compliments
2. Per-hotel   → dimension scores (1–10), best_for tags, strengths, weaknesses
"""

import os
import json
from anthropic import Anthropic

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _client = Anthropic(api_key=key)
    return _client


SYSTEM = (
    "You are a hotel operations analyst. "
    "Respond with valid JSON only — no markdown fences, no prose."
)

# ── Review-level analysis ──────────────────────────────────────────────────────

_REVIEW_SYSTEM = SYSTEM + """

Categories:
- housekeeping : cleanliness, towels, linens, bathroom, maid service
- food         : restaurant, room service, breakfast, bar, food quality
- front_desk   : check-in, checkout, concierge, staff attitude, wait times
- maintenance  : broken fixtures, HVAC, WiFi, plumbing, elevators, TV
- room_quality : room size, noise, bed comfort, view, decor, in-room amenities
"""

_REVIEW_PROMPT = """\
Analyze the hotel reviews below. Return a JSON array — one object per review in the same order.

Each object:
{
  "sentiment": "positive"|"neutral"|"negative",
  "categories": [list from: housekeeping, food, front_desk, maintenance, room_quality],
  "complaints":  [up to 4 specific complaint phrases],
  "compliments": [up to 4 specific compliment phrases]
}

Reviews:
"""


def analyze_reviews(reviews: list[dict]) -> list[dict]:
    """Input: list of {text, rating?}. Returns parallel list of analysis dicts."""
    if not reviews:
        return []

    client = get_client()
    results: list[dict] = []

    for i in range(0, len(reviews), 8):
        batch = reviews[i: i + 8]
        numbered = "\n\n".join(f"[{j+1}] {r['text']}" for j, r in enumerate(batch))
        try:
            resp = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=2048,
                system=_REVIEW_SYSTEM,
                messages=[{"role": "user", "content": _REVIEW_PROMPT + numbered}],
            )
            parsed = _parse_json(resp.content[0].text)
            if isinstance(parsed, list) and len(parsed) == len(batch):
                results.extend(parsed)
            else:
                results.extend(_empty_review() for _ in batch)
        except Exception as e:
            print(f"[analyze_reviews batch {i}] {e}")
            results.extend(_empty_review() for _ in batch)

    return results


def _empty_review() -> dict:
    return {"sentiment": "neutral", "categories": [], "complaints": [], "compliments": []}


# ── Hotel-level scoring ────────────────────────────────────────────────────────

_SCORE_PROMPT = """\
Score this hotel based on its guest reviews.

Rate each dimension 1.0–10.0 (one decimal). Be calibrated:
  9–10 = genuinely exceptional  |  7–8 = good  |  5–6 = average  |  3–4 = poor  |  1–2 = terrible

Scoring guidelines:
- overall     : holistic guest experience score
- cleanliness : room and property cleanliness
- service     : staff responsiveness, friendliness, helpfulness
- food        : restaurant, breakfast, room service quality
- value       : price-to-quality ratio
- maintenance : physical condition, working facilities, WiFi, HVAC

best_for tags (pick 1–3): business | families | romance | budget | luxury | solo | groups | long_stay

Return JSON:
{{
  "overall": 7.4,
  "cleanliness": 8.1,
  "service": 7.0,
  "food": 6.5,
  "value": 7.2,
  "maintenance": 6.8,
  "best_for": ["business", "solo"],
  "strengths": ["three short phrases of what guests consistently praise"],
  "weaknesses": ["three short phrases of recurring complaints"],
  "summary": "Two-sentence summary of the hotel's overall guest experience."
}}

Hotel: {name} — {city}
Reviews analysed: {count} | Average guest rating: {avg}/5

Sample reviews:
{excerpts}
"""


def score_hotel(name: str, city: str, reviews: list[dict]) -> dict:
    """Returns scoring dict with dimension scores, tags, strengths, weaknesses."""
    if not reviews:
        return _default_scores()

    client = get_client()

    ratings = [r["rating"] for r in reviews if r.get("rating") is not None]
    avg = round(sum(ratings) / len(ratings), 1) if ratings else 3.0

    # Sample diverse reviews: take negative-leaning first (more signal), then positive
    sorted_reviews = sorted(reviews, key=lambda r: r.get("rating") or 3)
    sample = sorted_reviews[:10] + sorted_reviews[-10:]
    excerpts = "\n---\n".join(r["text"][:400] for r in sample[:20])

    prompt = _SCORE_PROMPT.format(
        name=name, city=city, count=len(reviews), avg=avg, excerpts=excerpts
    )

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json(resp.content[0].text)
    except Exception as e:
        print(f"[score_hotel] {name}: {e}")
        return _default_scores()


def _default_scores() -> dict:
    return {
        "overall": None, "cleanliness": None, "service": None,
        "food": None, "value": None, "maintenance": None,
        "best_for": [], "strengths": [], "weaknesses": [], "summary": "",
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) > 1 else text
    return json.loads(text)
