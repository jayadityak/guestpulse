import { NextRequest, NextResponse } from "next/server";
import { startSearch, getCityHotels } from "@/lib/backend";
import { MOCK_HOTELS } from "@/data/mock-hotels";
import { rankHotels } from "@/lib/ranking";

// POST /api/search — kick off a real backend search job
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = await startSearch({
      city: body.city,
      platforms: body.platforms || ["google", "tripadvisor"],
      max_hotels: body.max_hotels || 10,
      reviews_per_hotel: body.reviews_per_hotel || 40,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// GET /api/search — fallback: return mock data ranked by params (used when backend unavailable)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const city = p.get("city") || "";

  // Try real backend first
  try {
    const hotels = await getCityHotels(city);
    if (hotels.length > 0) {
      return NextResponse.json({ hotels, total: hotels.length, city, source: "live" });
    }
  } catch {
    // Backend unavailable — fall through to mock
  }

  // Fallback: mock data
  const params = {
    city,
    budgetMin: Number(p.get("budgetMin") || 0),
    budgetMax: Number(p.get("budgetMax") || 999999),
    tripType: (p.get("tripType") || "") as any,
    priorities: (p.get("priorities") || "") as unknown as string[],
    guests: Number(p.get("guests") || 1),
  };
  await new Promise((r) => setTimeout(r, 600));
  const ranked = rankHotels(MOCK_HOTELS, params);
  return NextResponse.json({ hotels: ranked, total: ranked.length, city, source: "mock" });
}
