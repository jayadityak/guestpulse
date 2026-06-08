import { NextResponse } from "next/server";
import { getMadisonHotels } from "@/lib/backend";

export async function GET() {
  try {
    const hotels = await getMadisonHotels();
    if (hotels.length === 0) {
      // Backend is still scraping — tell the frontend to show the "collecting" state
      return NextResponse.json(
        { hotels: [], status: "collecting", message: "Hotel data is being collected. This takes about 10–15 minutes on first run." },
        { status: 202 }
      );
    }
    return NextResponse.json({ hotels, status: "ready" });
  } catch {
    return NextResponse.json(
      { hotels: [], status: "error", message: "Backend unavailable. Start the backend server and try again." },
      { status: 503 }
    );
  }
}
