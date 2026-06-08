import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8001";

/**
 * POST /api/recommend/stream
 *
 * Thin SSE proxy to FastAPI POST /recommend/stream.
 * Passes through the raw `text/event-stream` from the backend
 * so the browser sees a real streaming response.
 */
export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = body?.query?.trim();
    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/recommend/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      // Node 18 + fetch supports streaming natively; disable body timeout
      // @ts-expect-error: duplex is valid on fetch in Node 18+
      duplex: "half",
    });
  } catch {
    // Backend is down
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Backend unavailable" })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      }
    );
  }

  if (backendRes.status === 503) {
    return new Response(
      `data: ${JSON.stringify({ type: "collecting", message: "Hotel data is still being collected." })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  if (!backendRes.ok || !backendRes.body) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Backend error" })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      }
    );
  }

  // Pass through the backend SSE stream directly
  return new Response(backendRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
