"""
GuestPulse backend API.

Key design:
- Scraping + analysis happens in background jobs, never on the critical path
- Results stream to frontend as each hotel completes (no waiting for all 10)
- 7-day cache: cities already scraped return instantly
- /precompute endpoint lets us pre-populate top cities off-peak
"""

import os
import asyncio
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env", override=True)

import json as _json
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import init_db, get_db, SessionLocal
from models import HotelORM, ReviewORM, CitySearchRequest, HotelOut, ReviewOut, JobProgress, RecommendRequest, HotelRecommendation
from google_places_scraper import discover_and_collect
from analyzer import analyze_reviews, score_hotel  # both used in pipeline
from recommender import recommend as nlp_recommend, stream_recommendations

app = FastAPI(title="GuestPulse API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-process job store: { job_id: dict }
_jobs: dict[str, dict] = {}

CACHE_TTL_DAYS = 30
MADISON_CITY = os.getenv("TARGET_CITY", "Madison, Wisconsin")


FIXTURE_PATH = Path(__file__).parent / "seed_fixture.json"


def _load_fixture(db: Session) -> int:
    """
    Load pre-scraped Madison hotel data from seed_fixture.json into DB.
    Returns number of hotels inserted. Skips hotels already present by name.
    Runs in < 1 second — no network calls.
    """
    if not FIXTURE_PATH.exists():
        return 0

    with open(FIXTURE_PATH) as f:
        hotels_data = _json.load(f)

    inserted = 0
    for hd in hotels_data:
        exists = db.query(HotelORM).filter(
            HotelORM.city.ilike(MADISON_CITY),
            HotelORM.name == hd["name"],
        ).first()
        if exists:
            continue

        hotel_orm = HotelORM(
            name=hd["name"],
            city=hd.get("city", MADISON_CITY),
            address=hd.get("address", ""),
            platform=hd.get("platform", "google"),
            url=hd.get("url", ""),
            phone=hd.get("phone", ""),
            price_range=hd.get("price_range", ""),
            avg_rating=hd.get("avg_rating"),
            total_reviews=hd.get("total_reviews", 0),
            overall_score=hd.get("overall_score"),
            cleanliness_score=hd.get("cleanliness_score"),
            service_score=hd.get("service_score"),
            food_score=hd.get("food_score"),
            value_score=hd.get("value_score"),
            maintenance_score=hd.get("maintenance_score"),
            best_for=hd.get("best_for", []),
            strengths=hd.get("strengths", []),
            weaknesses=hd.get("weaknesses", []),
            ai_summary=hd.get("ai_summary", ""),
            scraped_at=datetime.utcnow(),
            analyzed_at=datetime.utcnow(),
        )
        db.add(hotel_orm)
        db.flush()

        for rv in hd.get("reviews", []):
            db.add(ReviewORM(
                hotel_id=hotel_orm.id,
                reviewer_name=rv.get("reviewer_name", "Guest"),
                date=rv.get("date"),
                raw_text=rv.get("raw_text", ""),
                rating=rv.get("rating"),
                source=rv.get("source", "google"),
                sentiment=rv.get("sentiment"),
                categories=rv.get("categories", []),
                complaints=rv.get("complaints", []),
                compliments=rv.get("compliments", []),
            ))

        inserted += 1

    db.commit()
    return inserted


@app.on_event("startup")
async def startup():
    init_db()
    db = SessionLocal()
    try:
        if not _city_is_fresh(MADISON_CITY, db):
            # Try instant fixture load first
            n = _load_fixture(db)
            if n > 0:
                print(f"[startup] Loaded {n} hotels from fixture instantly ✓")
            else:
                print(f"[startup] No fixture — kicking off background scrape")
                req = CitySearchRequest(city=MADISON_CITY, max_hotels=60, reviews_per_hotel=5)
                job = _new_job(MADISON_CITY, 60)
                asyncio.create_task(_run_pipeline(job["job_id"], req))
        else:
            count = db.query(HotelORM).filter(
                HotelORM.city.ilike(MADISON_CITY), HotelORM.analyzed_at.isnot(None)
            ).count()
            print(f"[startup] Madison cache fresh — {count} hotels ready ✓")
    finally:
        db.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _city_is_fresh(city: str, db: Session) -> bool:
    """True if city was scraped and fully analyzed within the TTL."""
    cutoff = datetime.utcnow() - timedelta(days=CACHE_TTL_DAYS)
    count = (
        db.query(HotelORM)
        .filter(
            HotelORM.city.ilike(city),
            HotelORM.analyzed_at.isnot(None),
            HotelORM.analyzed_at >= cutoff,
        )
        .count()
    )
    return count >= 5  # at least 5 analyzed hotels = consider fresh


def _new_job(city: str, max_hotels: int) -> dict:
    job_id = f"job_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    job = {
        "job_id": job_id,
        "city": city,
        "status": "queued",
        "phase": "Queued…",
        "hotels_total": max_hotels,
        "hotels_done": 0,
        "current_hotel": None,
        "error": None,
    }
    _jobs[job_id] = job
    return job


# ── Search ────────────────────────────────────────────────────────────────────

@app.post("/search")
async def start_search(req: CitySearchRequest, bg: BackgroundTasks, db: Session = Depends(get_db)):
    city = req.city.strip()

    if not req.force and _city_is_fresh(city, db):
        job = _new_job(city, req.max_hotels)
        job.update(status="done", phase="Loaded from cache", hotels_done=req.max_hotels)
        return {"job_id": job["job_id"], "cached": True}

    # Wipe stale/seed data for this city so we get a clean run
    stale = db.query(HotelORM).filter(HotelORM.city.ilike(city)).all()
    for h in stale:
        db.delete(h)
    db.commit()

    job = _new_job(city, req.max_hotels)
    bg.add_task(_run_pipeline, job["job_id"], req)
    return {"job_id": job["job_id"], "cached": False}


@app.get("/search/{job_id}", response_model=JobProgress)
def get_job(job_id: str):
    j = _jobs.get(job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return JobProgress(**j)


# ── Pipeline ──────────────────────────────────────────────────────────────────

async def _score_with_retry(loop, name: str, city: str, raw_reviews: list, max_retries: int = 3) -> dict:
    """
    Run score_hotel() in a thread pool with exponential backoff on rate-limit (429) errors.
    """
    for attempt in range(max_retries):
        try:
            return await loop.run_in_executor(None, score_hotel, name, city, raw_reviews)
        except Exception as e:
            msg = str(e)
            if "429" in msg and attempt < max_retries - 1:
                wait = 2 ** attempt + 1   # 2s, 3s, 5s
                print(f"  [rate limit] {name} — retrying in {wait}s (attempt {attempt+1})")
                await asyncio.sleep(wait)
            else:
                print(f"  [score_hotel failed] {name}: {e}")
                return {}
    return {}


async def _analyze_one_hotel(
    sem: asyncio.Semaphore,
    loop,
    hotel_data: dict,
    hotel_id: int,
    city: str,
    j: dict,
) -> tuple[int, dict, list]:
    """
    Parallel Claude analysis — runs two passes per hotel:

    Pass 1 (Haiku): analyze_reviews  — sentiment, categories, complaints, compliments
                    5 reviews = 1 batch = 1 Haiku call, very cheap & fast
    Pass 2 (Sonnet): score_hotel     — dimension scores, summary, strengths/weaknesses
                    1 call per hotel

    Semaphore(3) keeps concurrent calls to 6 total (3 × 2 passes), well within Tier 1.
    """
    async with sem:
        name = hotel_data["name"]
        raw_reviews = hotel_data.get("reviews", [])

        if not raw_reviews:
            j["hotels_done"] += 1
            return hotel_id, {}, []

        # Pass 1: per-review analysis (Haiku, ~1 call for 5 reviews)
        try:
            review_analyses = await loop.run_in_executor(None, analyze_reviews, raw_reviews)
        except Exception as e:
            print(f"  [analyze_reviews failed] {name}: {e}")
            review_analyses = []

        # Pass 2: hotel scoring (Sonnet, 1 call)
        scores = await _score_with_retry(loop, name, city, raw_reviews)

        j["hotels_done"] += 1
        print(f"[✓] {name} | {len(raw_reviews)} reviews | score={scores.get('overall')}")
        return hotel_id, scores, review_analyses


async def _run_pipeline(job_id: str, req: CitySearchRequest):
    """
    Three-phase parallel pipeline — target: < 30 seconds total.

    Phase 1 — Google Places API (~5s):   1 text-search + 20 parallel detail calls
    Phase 2 — DB insert:                 batch-save all hotel shells
    Phase 3 — Claude analysis (parallel):all hotels scored concurrently (semaphore=5)
    """
    j = _jobs[job_id]
    city = req.city.strip()

    try:
        j.update(status="running", phase=f"Discovering hotels in {city}…")
        t_start = datetime.utcnow()

        # ── Phase 1: Playwright parallel scrape ───────────────────────────────
        hotels_raw = await discover_and_collect(
            city=city,
            max_hotels=req.max_hotels,
            reviews_per_hotel=req.reviews_per_hotel,
        )

        if not hotels_raw:
            j.update(status="error", error="No hotels found on Google Maps.")
            return

        j.update(hotels_total=len(hotels_raw), phase="Saving hotels to database…")

        # ── Phase 2: batch-insert all hotel shells to get their IDs ──────────
        db = SessionLocal()
        hotel_id_map: dict[str, int] = {}  # name → hotel_id
        try:
            for hotel_data in hotels_raw:
                name = hotel_data["name"]
                orm = HotelORM(
                    name=name,
                    city=city,
                    address=hotel_data.get("address", ""),
                    platform="google",
                    url=hotel_data.get("url", ""),
                    phone=hotel_data.get("phone", ""),
                    price_range=hotel_data.get("price_range", ""),
                    avg_rating=hotel_data.get("avg_rating"),
                    scraped_at=datetime.utcnow(),
                )
                db.add(orm)
                db.flush()   # assigns orm.id without committing
                hotel_id_map[name] = orm.id
            db.commit()
        finally:
            db.close()

        # ── Phase 3: parallel Claude scoring ──────────────────────────────────
        # Only score_hotel (1 call/hotel). analyze_reviews skipped — it blasts
        # 2+ calls/hotel × 20 hotels = rate-limit storm on Tier 1 accounts.
        j.update(phase=f"Analysing {len(hotels_raw)} hotels in parallel…")
        loop = asyncio.get_event_loop()
        sem = asyncio.Semaphore(3)   # 3 hotels × 2 Claude passes = 6 concurrent calls, safe on Tier 1

        tasks = [
            _analyze_one_hotel(sem, loop, hd, hotel_id_map[hd["name"]], city, j)
            for hd in hotels_raw
            if hd["name"] in hotel_id_map
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── Write scores + raw reviews back to DB ─────────────────────────────
        db = SessionLocal()
        try:
            for hotel_data, result in zip(hotels_raw, results):
                if isinstance(result, Exception):
                    print(f"[pipeline error] {hotel_data['name']}: {result}")
                    continue

                hotel_id, scores, review_analyses = result
                raw_reviews = hotel_data.get("reviews", [])

                # Store reviews with full per-review Claude analysis
                if raw_reviews:
                    for i, rv in enumerate(raw_reviews):
                        analysis = review_analyses[i] if i < len(review_analyses) else {}
                        db.add(ReviewORM(
                            hotel_id=hotel_id,
                            reviewer_name=rv.get("reviewer", "Anonymous"),
                            date=rv.get("date"),
                            raw_text=rv["text"],
                            rating=rv.get("rating"),
                            source=rv.get("source", "google"),
                            sentiment=analysis.get("sentiment"),
                            categories=analysis.get("categories", []),
                            complaints=analysis.get("complaints", []),
                            compliments=analysis.get("compliments", []),
                        ))

                if scores:
                    db.query(HotelORM).filter(HotelORM.id == hotel_id).update({
                        "total_reviews":      len(raw_reviews),
                        "overall_score":      scores.get("overall"),
                        "cleanliness_score":  scores.get("cleanliness"),
                        "service_score":      scores.get("service"),
                        "food_score":         scores.get("food"),
                        "value_score":        scores.get("value"),
                        "maintenance_score":  scores.get("maintenance"),
                        "best_for":           scores.get("best_for", []),
                        "strengths":          scores.get("strengths", []),
                        "weaknesses":         scores.get("weaknesses", []),
                        "ai_summary":         scores.get("summary", ""),
                        "analyzed_at":        datetime.utcnow(),
                    })

            db.commit()
        finally:
            db.close()

        elapsed = (datetime.utcnow() - t_start).seconds
        print(f"\n[pipeline] Complete — {j['hotels_done']}/{j['hotels_total']} hotels in {elapsed}s")
        j.update(status="done", phase="Complete", current_hotel=None)

    except Exception as e:
        import traceback; traceback.print_exc()
        j.update(status="error", error=str(e))


# ── Madison-specific endpoints ────────────────────────────────────────────────

@app.get("/madison/hotels", response_model=list[HotelOut])
def get_madison_hotels(db: Session = Depends(get_db)):
    """All analyzed Madison hotels sorted by overall score — used for default page load."""
    hotels = (
        db.query(HotelORM)
        .filter(
            HotelORM.city.ilike(MADISON_CITY),
            HotelORM.analyzed_at.isnot(None),
        )
        .all()
    )
    return sorted(hotels, key=lambda h: h.overall_score or 0, reverse=True)


@app.post("/recommend", response_model=list[HotelRecommendation])
async def recommend_hotels(req: RecommendRequest, db: Session = Depends(get_db)):
    """
    NLP hotel recommendation for Madison.
    Takes a natural language query, returns all hotels ranked + annotated for the query.
    """
    hotels = (
        db.query(HotelORM)
        .filter(
            HotelORM.city.ilike(MADISON_CITY),
            HotelORM.analyzed_at.isnot(None),
        )
        .all()
    )

    if not hotels:
        raise HTTPException(503, "Madison hotel data not yet available. Try again in a few minutes while the background scrape completes.")

    matches = await nlp_recommend(req.query, hotels)

    # Build lookup: hotel_id → match data
    match_map: dict[int, dict] = {m["hotel_id"]: m for m in matches}

    # Merge and sort by rank
    result = []
    for hotel in hotels:
        match = match_map.get(hotel.id, {})
        rec = HotelRecommendation.model_validate(hotel)
        rec.match_score = match.get("match_score")
        rec.why_it_fits = match.get("why_it_fits")
        result.append(rec)

    result.sort(key=lambda h: match_map.get(h.id, {}).get("rank", 999))
    return result


@app.post("/recommend/stream")
async def recommend_stream(req: RecommendRequest, db: Session = Depends(get_db)):
    """
    Streaming SSE recommendation endpoint.

    Immediately yields heuristic-ranked hotels (~150ms),
    then streams Claude Haiku-generated 'why_it_fits' explanations one by one.
    First meaningful content reaches the client in < 500ms.
    """
    hotels = (
        db.query(HotelORM)
        .filter(
            HotelORM.city.ilike(MADISON_CITY),
            HotelORM.analyzed_at.isnot(None),
        )
        .all()
    )

    if not hotels:
        raise HTTPException(503, "No hotel data yet — scrape still running.")

    async def event_stream():
        async for event in stream_recommendations(req.query, hotels):
            yield f"data: {_json.dumps(event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── City results ──────────────────────────────────────────────────────────────

@app.get("/cities", response_model=list[str])
def list_cities(db: Session = Depends(get_db)):
    rows = db.query(HotelORM.city).distinct().all()
    return sorted(set(r[0] for r in rows))


@app.get("/cities/{city}/hotels", response_model=list[HotelOut])
def get_city_hotels(
    city: str,
    sort_by: str = "overall_score",
    include_partial: bool = True,   # return hotels even if job is still running
    db: Session = Depends(get_db),
):
    q = db.query(HotelORM).filter(HotelORM.city.ilike(city))
    if not include_partial:
        q = q.filter(HotelORM.analyzed_at.isnot(None))
    hotels = q.all()

    valid = {"overall_score","avg_rating","cleanliness_score","service_score",
             "food_score","value_score","maintenance_score","total_reviews"}
    if sort_by in valid:
        hotels = sorted(hotels, key=lambda h: getattr(h, sort_by) or 0, reverse=True)
    return hotels


@app.get("/cities/{city}/status")
def get_city_status(city: str, db: Session = Depends(get_db)):
    total = db.query(HotelORM).filter(HotelORM.city.ilike(city)).count()
    analyzed = db.query(HotelORM).filter(
        HotelORM.city.ilike(city), HotelORM.analyzed_at.isnot(None)
    ).count()
    last = db.query(HotelORM.analyzed_at).filter(
        HotelORM.city.ilike(city), HotelORM.analyzed_at.isnot(None)
    ).order_by(HotelORM.analyzed_at.desc()).first()
    return {
        "city": city,
        "total_hotels": total,
        "analyzed_hotels": analyzed,
        "is_fresh": _city_is_fresh(city, db),
        "last_analyzed": last[0].isoformat() if last else None,
    }


@app.delete("/cities/{city}")
def delete_city(city: str, db: Session = Depends(get_db)):
    hotels = db.query(HotelORM).filter(HotelORM.city.ilike(city)).all()
    for h in hotels:
        db.delete(h)
    db.commit()
    return {"deleted": len(hotels)}


# ── Pre-computation ───────────────────────────────────────────────────────────

TOP_CITIES = [
    "New York", "Paris", "London", "Tokyo", "Dubai",
    "Rome", "Barcelona", "Singapore", "Bangkok", "Amsterdam",
    "Sydney", "Istanbul", "Prague", "Lisbon", "Miami",
    "Los Angeles", "Chicago", "San Francisco", "Las Vegas", "Bali",
]


@app.post("/precompute")
async def precompute(bg: BackgroundTasks, cities: list[str] = None, db: Session = Depends(get_db)):
    """Kick off background scraping for a list of cities (defaults to top 20)."""
    target = cities or TOP_CITIES
    jobs = []
    for city in target:
        if not _city_is_fresh(city, db):
            req = CitySearchRequest(city=city, max_hotels=10, reviews_per_hotel=40)
            job = _new_job(city, 10)
            bg.add_task(_run_pipeline, job["job_id"], req)
            jobs.append(job["job_id"])
    return {"queued": len(jobs), "cities": target[:len(jobs)]}


# ── Hotel detail ──────────────────────────────────────────────────────────────

@app.get("/hotels/{hotel_id}", response_model=HotelOut)
def get_hotel(hotel_id: int, db: Session = Depends(get_db)):
    h = db.get(HotelORM, hotel_id)
    if not h:
        raise HTTPException(404, "Hotel not found")
    return h


@app.get("/hotels/{hotel_id}/reviews", response_model=list[ReviewOut])
def get_hotel_reviews(
    hotel_id: int,
    sentiment: str = None,
    source: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(ReviewORM).filter(ReviewORM.hotel_id == hotel_id)
    if sentiment:
        q = q.filter(ReviewORM.sentiment == sentiment)
    if source:
        q = q.filter(ReviewORM.source == source)
    return q.offset(skip).limit(limit).all()


@app.get("/hotels/{hotel_id}/insights")
def get_hotel_insights(hotel_id: int, db: Session = Depends(get_db)):
    reviews = db.query(ReviewORM).filter(ReviewORM.hotel_id == hotel_id).all()
    if not reviews:
        return {}
    sentiment_counts = Counter(r.sentiment for r in reviews if r.sentiment)
    category_counts: Counter = Counter()
    complaint_counts: Counter = Counter()
    source_counts: Counter = Counter()
    for r in reviews:
        for c in (r.categories or []):
            category_counts[c] += 1
        for c in (r.complaints or []):
            complaint_counts[c.lower().strip()] += 1
        if r.source:
            source_counts[r.source] += 1
    ratings = [r.rating for r in reviews if r.rating is not None]
    return {
        "total_reviews": len(reviews),
        "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "sentiment_counts": dict(sentiment_counts),
        "category_counts": dict(category_counts),
        "source_counts": dict(source_counts),
        "top_complaints": [
            {"complaint": c, "count": n}
            for c, n in complaint_counts.most_common(10)
        ],
    }
