from sqlalchemy import Column, Integer, String, Float, Text, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import DeclarativeBase, relationship
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class Base(DeclarativeBase):
    pass


class HotelORM(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False, index=True)
    address = Column(String)
    platform = Column(String)
    url = Column(String)
    phone = Column(String)
    price_range = Column(String)

    avg_rating = Column(Float)
    total_reviews = Column(Integer, default=0)

    # AI dimension scores 1.0–10.0
    overall_score = Column(Float)
    cleanliness_score = Column(Float)
    service_score = Column(Float)
    food_score = Column(Float)
    value_score = Column(Float)
    maintenance_score = Column(Float)

    best_for = Column(JSON, default=list)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    ai_summary = Column(Text)

    scraped_at = Column(DateTime, default=datetime.utcnow)
    analyzed_at = Column(DateTime)

    reviews = relationship("ReviewORM", back_populates="hotel", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hotel_city_name", "city", "name"),
    )


class ReviewORM(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False)
    reviewer_name = Column(String, default="Anonymous")
    date = Column(String)
    raw_text = Column(Text, nullable=False)
    rating = Column(Float)
    source = Column(String)

    # Claude-extracted fields
    sentiment = Column(String)
    categories = Column(JSON, default=list)
    complaints = Column(JSON, default=list)
    compliments = Column(JSON, default=list)

    hotel = relationship("HotelORM", back_populates="reviews")


# ── Pydantic ───────────────────────────────────────────────────────────────────

class CitySearchRequest(BaseModel):
    city: str
    platforms: list[str] = ["google", "tripadvisor"]
    max_hotels: int = 10
    reviews_per_hotel: int = 40
    force: bool = False  # bypass cache and re-scrape


class HotelOut(BaseModel):
    id: int
    name: str
    city: str
    address: Optional[str] = None
    platform: Optional[str] = None
    url: Optional[str] = None
    price_range: Optional[str] = None
    avg_rating: Optional[float] = None
    total_reviews: int = 0
    overall_score: Optional[float] = None
    cleanliness_score: Optional[float] = None
    service_score: Optional[float] = None
    food_score: Optional[float] = None
    value_score: Optional[float] = None
    maintenance_score: Optional[float] = None
    best_for: list[str] = []
    strengths: list[str] = []
    weaknesses: list[str] = []
    ai_summary: Optional[str] = None

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: int
    hotel_id: int
    reviewer_name: str
    date: Optional[str] = None
    raw_text: str
    rating: Optional[float] = None
    source: Optional[str] = None
    sentiment: Optional[str] = None
    categories: list[str] = []
    complaints: list[str] = []
    compliments: list[str] = []

    model_config = {"from_attributes": True}


class JobProgress(BaseModel):
    job_id: str
    city: str
    status: str  # queued | running | done | error
    phase: str
    hotels_total: int
    hotels_done: int
    current_hotel: Optional[str] = None
    error: Optional[str] = None


class RecommendRequest(BaseModel):
    query: str


class HotelMatch(BaseModel):
    match_score: int
    why_it_fits: str


class HotelRecommendation(HotelOut):
    """HotelOut extended with NLP match data."""
    match_score: Optional[int] = None
    why_it_fits: Optional[str] = None
