import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/lib/backend";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }
    const hotels = await getRecommendations(query.trim());
    return NextResponse.json({ hotels, query });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // If backend has no hotels yet (still scraping)
    if (msg.includes("503") || msg.includes("unavailable")) {
      return NextResponse.json(
        { hotels: [], status: "collecting", message: "Hotel data is still being collected. Please wait a few minutes." },
        { status: 202 }
      );
    }
    return NextResponse.json(
      { hotels: [], status: "error", message: "Backend unavailable. Make sure the backend server is running." },
      { status: 503 }
    );
  }
}
