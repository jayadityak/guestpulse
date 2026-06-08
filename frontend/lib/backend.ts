/**
 * Proxy layer between GuestPulse Next.js frontend and the FastAPI backend.
 * Transforms backend schema → frontend Hotel type.
 */
import type { Hotel } from "./types";

const BASE = process.env.BACKEND_URL || "http://localhost:8001";

// ── Raw backend shapes ────────────────────────────────────────────────────────

interface BackendHotelRecommendation extends BackendHotel {
  match_score?: number;
  why_it_fits?: string;
}

interface BackendHotel {
  id: number;
  name: string;
  city: string;
  address?: string;
  platform?: string;
  url?: string;
  price_range?: string;
  avg_rating?: number;
  total_reviews: number;
  overall_score?: number;
  cleanliness_score?: number;
  service_score?: number;
  food_score?: number;
  value_score?: number;
  maintenance_score?: number;
  best_for: string[];
  strengths: string[];
  weaknesses: string[];
  ai_summary?: string;
}

export interface JobStatus {
  job_id: string;
  city: string;
  status: "queued" | "running" | "done" | "error";
  phase: string;
  hotels_total: number;
  hotels_done: number;
  current_hotel?: string;
  error?: string;
}

// ── Raw shape from /recommend/stream "hotels" event ──────────────────────────

export interface StreamHotel {
  id: number;
  name: string;
  address: string;
  price_range: string;
  avg_rating: number | null;
  total_reviews: number;
  scores: {
    overall: number | null;
    cleanliness: number | null;
    service: number | null;
    food: number | null;
    value: number | null;
    maintenance: number | null;
  };
  best_for: string[];
  summary: string;
}

// ── Transform backend → frontend Hotel ───────────────────────────────────────

/**
 * Google Places price level → estimated Madison nightly rate.
 * "$" ≈ budget motels, "$$" ≈ mid-range chains, "$$$" ≈ upscale downtown, "$$$$" ≈ luxury.
 */
function priceFromRange(priceRange?: string | null): number {
  const map: Record<string, number> = {
    "$": 90,
    "$$": 149,
    "$$$": 229,
    "$$$$": 349,
  };
  return map[priceRange ?? ""] ?? 0;
}

function s(raw?: number | null): number {
  // Convert 1–10 scale → 0–100, clamp, round
  if (raw == null || raw === 0) return 0;
  return Math.round(Math.min(100, Math.max(0, raw * 10)));
}

export function transformHotel(h: BackendHotel): Hotel {
  const overall = s(h.overall_score);
  const cleanliness = s(h.cleanliness_score);
  const service = s(h.service_score);
  const food = s(h.food_score);
  const value = s(h.value_score);
  const maintenance = s(h.maintenance_score);
  // Noise / location are not separately tracked in the backend yet — derive from overall + available dims
  const location = Math.round((cleanliness + service) / 2); // placeholder until backend tracks it
  const noise = maintenance;
  const roomQuality = Math.round((cleanliness + service) / 2);

  return {
    id: String(h.id),
    name: h.name,
    city: h.city,
    neighborhood: h.address?.split(",")[0] || h.city,
    address: h.address || "",
    starRating: 4,
    pricePerNight: priceFromRange(h.price_range),
    imageUrl: `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80`,
    bookingUrl: h.url || "https://booking.com",
    amenities: [],
    totalReviews: h.total_reviews,
    analysis: {
      guestPulseScore: overall || Math.round((cleanliness + service + food + value + maintenance) / 5),
      summary: h.ai_summary || "",
      bestFor: h.best_for || [],
      avoidIf: h.weaknesses?.map(w => `you mind: ${w}`) || [],
      scores: { cleanliness, service, location, noise, food, value, roomQuality, maintenance },
      positiveThemes: h.strengths?.map(s => ({ theme: s, frequency: 0, summary: "" })) || [],
      negativeThemes: h.weaknesses?.map(w => ({ theme: w, frequency: 0, summary: "" })) || [],
      repeatedComplaints: h.weaknesses || [],
      topStrengths: h.strengths || [],
      topRisks: h.weaknesses || [],
      finalVerdict: h.ai_summary || "",
    },
  };
}

/** Transform compact streaming hotel profile → frontend Hotel shape. */
export function transformStreamHotel(h: StreamHotel): Hotel {
  const overall     = s(h.scores.overall);
  const cleanliness = s(h.scores.cleanliness);
  const service     = s(h.scores.service);
  const food        = s(h.scores.food);
  const value       = s(h.scores.value);
  const maintenance = s(h.scores.maintenance);
  const location    = Math.round((cleanliness + service) / 2);
  const noise       = maintenance;
  const roomQuality = Math.round((cleanliness + service) / 2);

  return {
    id: String(h.id),
    name: h.name,
    city: "Madison, Wisconsin",
    neighborhood: h.address?.split(",")[0]?.trim() || "Madison",
    address: h.address || "",
    starRating: 4,
    pricePerNight: priceFromRange(h.price_range),
    imageUrl: `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80`,
    bookingUrl: "https://booking.com",
    amenities: [],
    totalReviews: h.total_reviews,
    analysis: {
      guestPulseScore: overall || Math.round((cleanliness + service + food + value + maintenance) / 5),
      summary: h.summary || "",
      bestFor: h.best_for || [],
      avoidIf: [],
      scores: { cleanliness, service, location, noise, food, value, roomQuality, maintenance },
      positiveThemes: [],
      negativeThemes: [],
      repeatedComplaints: [],
      topStrengths: h.best_for || [],
      topRisks: [],
      finalVerdict: h.summary || "",
    },
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function startSearch(params: {
  city: string;
  platforms?: string[];
  max_hotels?: number;
  reviews_per_hotel?: number;
}): Promise<{ job_id: string; cached: boolean }> {
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: params.city,
      platforms: params.platforms || ["google", "tripadvisor"],
      max_hotels: params.max_hotels || 10,
      reviews_per_hotel: params.reviews_per_hotel || 40,
    }),
  });
  if (!res.ok) throw new Error(`Backend search failed: ${res.status}`);
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/search/${jobId}`);
  if (!res.ok) throw new Error(`Job status failed: ${res.status}`);
  return res.json();
}

export async function getCityHotels(city: string): Promise<Hotel[]> {
  const res = await fetch(`${BASE}/cities/${encodeURIComponent(city)}/hotels?sort_by=overall_score`);
  if (!res.ok) throw new Error(`City hotels failed: ${res.status}`);
  const raw: BackendHotel[] = await res.json();
  return raw.map(transformHotel);
}

export async function getMadisonHotels(): Promise<Hotel[]> {
  const res = await fetch(`${BASE}/madison/hotels`);
  if (!res.ok) throw new Error(`Madison hotels failed: ${res.status}`);
  const raw: BackendHotel[] = await res.json();
  return raw.map(transformHotel);
}

export async function getRecommendations(query: string): Promise<Hotel[]> {
  const res = await fetch(`${BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  const raw: BackendHotelRecommendation[] = await res.json();
  return raw.map((h) => {
    const hotel = transformHotel(h);
    hotel.matchScore = h.match_score;
    hotel.matchReason = h.why_it_fits;
    return hotel;
  });
}

export async function getHotelInsights(hotelId: string) {
  const res = await fetch(`${BASE}/hotels/${hotelId}/insights`);
  if (!res.ok) return null;
  return res.json();
}

export async function getHotelReviews(hotelId: string) {
  const res = await fetch(`${BASE}/hotels/${hotelId}/reviews?limit=20`);
  if (!res.ok) return [];
  return res.json();
}
