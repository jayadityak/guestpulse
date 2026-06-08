import { NextRequest, NextResponse } from "next/server";

// In-memory store for demo (in production, use a database)
const saved = new Set<string>();

export async function GET() {
  return NextResponse.json({ saved: Array.from(saved) });
}

export async function POST(req: NextRequest) {
  const { hotelId } = await req.json();
  saved.add(hotelId);
  return NextResponse.json({ saved: Array.from(saved) });
}

export async function DELETE(req: NextRequest) {
  const { hotelId } = await req.json();
  saved.delete(hotelId);
  return NextResponse.json({ saved: Array.from(saved) });
}
