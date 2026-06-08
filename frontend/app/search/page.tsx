"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HotelCard } from "@/components/hotels/hotel-card";
import { NlpSearchForm } from "@/components/search/nlp-search-form";
import { Sparkles, Clock, ServerCrash } from "lucide-react";
import type { Hotel } from "@/lib/types";
import { transformStreamHotel, type StreamHotel } from "@/lib/backend";

const SORT_OPTIONS = [
  { value: "best_match",   label: "Best Match" },
  { value: "best_overall", label: "Best Overall" },
  { value: "best_value",   label: "Best Value" },
  { value: "cleanest",     label: "Cleanest" },
  { value: "best_service", label: "Best Service" },
  { value: "lowest_noise", label: "Most Quiet" },
];

type PageStatus = "loading" | "ready" | "collecting" | "error";

function SearchPageInner() {
  const sp = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [streamingExplanations, setStreamingExplanations] = useState(false);
  const [phase, setPhase] = useState("Loading Madison hotels…");
  const [statusMessage, setStatusMessage] = useState("");
  const [sortBy, setSortBy] = useState("best_match");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const query = sp.get("q") || "";

  // Cancel any in-progress stream on unmount or new query
  useEffect(() => {
    return () => {
      readerRef.current?.cancel();
    };
  }, []);

  const fetchHotels = useCallback(async () => {
    // Cancel previous stream if any
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }

    setStatus("loading");
    setHotels([]);
    setStatusMessage("");
    setStreamingExplanations(false);

    if (query) {
      // ── Streaming NLP query ───────────────────────────────────────────────
      setPhase("Finding your perfect match…");

      let res: Response;
      try {
        res = await fetch("/api/recommend/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
      } catch {
        setStatus("error");
        setStatusMessage("Cannot reach backend. Make sure the backend server is running.");
        return;
      }

      if (!res.body) {
        setStatus("error");
        setStatusMessage("Streaming not supported.");
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") {
              setStreamingExplanations(false);
              return;
            }
            try {
              const event = JSON.parse(raw);

              if (event.type === "hotels") {
                // Stage 1 — heuristic ranked hotels arrive instantly
                const hotelList = (event.hotels as StreamHotel[]).map(transformStreamHotel);
                setHotels(hotelList);
                setSortBy("best_match");
                setStatus("ready");
                setStreamingExplanations(true); // explanations incoming
              } else if (event.type === "explanation") {
                // Stage 2 — explanations trickle in one by one
                const hotelId = String(event.hotel_id);
                setHotels((prev) =>
                  prev.map((h) =>
                    h.id === hotelId
                      ? { ...h, matchReason: event.why_it_fits, matchScore: event.match_score }
                      : h
                  )
                );
              } else if (event.type === "done") {
                setStreamingExplanations(false);
              } else if (event.type === "collecting") {
                setStatus("collecting");
                setStatusMessage(event.message || "Hotel data is still being collected.");
                setStreamingExplanations(false);
                return;
              } else if (event.type === "error") {
                setStatus("error");
                setStatusMessage(event.message || "Something went wrong.");
                setStreamingExplanations(false);
                return;
              }
            } catch {
              // Malformed JSON line — skip
            }
          }
        }
      } finally {
        readerRef.current = null;
        setStreamingExplanations(false);
      }
    } else {
      // ── Default browse — load all Madison hotels ──────────────────────────
      setPhase("Loading Madison hotels…");
      const res = await fetch("/api/madison/hotels");
      const data = await res.json();

      if (res.status === 202) {
        setStatus("collecting");
        setStatusMessage(data.message || "Hotel data is being collected. Come back in ~10 minutes.");
      } else if (!res.ok) {
        setStatus("error");
        setStatusMessage(data.message || "Backend server is not running.");
      } else {
        setHotels(data.hotels || []);
        setSortBy("best_overall");
        setStatus("ready");
      }
    }
  }, [query]);

  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  function toggleSave(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function sortedHotels() {
    const list = [...hotels];
    switch (sortBy) {
      case "best_match":    return list; // already heuristic-ranked from backend
      case "best_value":    return list.sort((a, b) => b.analysis.scores.value - a.analysis.scores.value);
      case "cleanest":      return list.sort((a, b) => b.analysis.scores.cleanliness - a.analysis.scores.cleanliness);
      case "best_service":  return list.sort((a, b) => b.analysis.scores.service - a.analysis.scores.service);
      case "lowest_noise":  return list.sort((a, b) => b.analysis.scores.noise - a.analysis.scores.noise);
      default:              return list.sort((a, b) => b.analysis.guestPulseScore - a.analysis.guestPulseScore);
    }
  }

  const results = sortedHotels();
  const isQueryMode = Boolean(query);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Search bar */}
      <div className="mb-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#1B2B4B] mb-1">
            {query ? "Your Madison hotel matches" : "All Madison Hotels"}
          </h1>
          {status === "ready" && (
            <p className="text-slate-500 text-sm flex items-center gap-2">
              {query ? (
                <>
                  <Sparkles size={13} className="text-emerald-500" />
                  <span>Ranked for: <span className="italic text-slate-600">"{query}"</span></span>
                  {streamingExplanations && (
                    <span className="text-xs text-emerald-600 animate-pulse">· matching…</span>
                  )}
                </>
              ) : (
                <span>{results.length} hotels ranked by overall guest rating</span>
              )}
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                ● Live data
              </span>
            </p>
          )}
        </div>
        <NlpSearchForm />
      </div>

      {/* Loading spinner */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-[#F5EFE6] border-t-[#1B2B4B] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#1B2B4B] font-bold text-[10px]">AI</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[#1B2B4B] font-semibold">{phase}</p>
            <p className="text-xs text-slate-400 mt-1">
              {query ? "Ranking hotels instantly, then streaming personalized explanations…" : "Fetching from the backend…"}
            </p>
          </div>
        </div>
      )}

      {/* Collecting state — backend is still scraping */}
      {status === "collecting" && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
            <Clock size={24} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-[#1B2B4B]">Collecting hotel data…</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{statusMessage}</p>
          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 text-left w-full">
            <p className="text-xs font-semibold text-amber-800 mb-1">What&apos;s happening:</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>Headless browser opening Google Maps</li>
              <li>Visiting each Madison hotel page</li>
              <li>Collecting 40 reviews per hotel</li>
              <li>Claude scoring all 8 dimensions</li>
            </ol>
          </div>
          <button
            onClick={fetchHotels}
            className="mt-4 text-sm font-semibold text-[#1B2B4B] underline underline-offset-2 hover:text-[#7C6A52]"
          >
            Check again
          </button>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-sm mx-auto">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
            <ServerCrash size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-[#1B2B4B]">Backend not running</h2>
          <p className="text-sm text-slate-500">{statusMessage}</p>
          <code className="text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-600">
            cd hotel-review-intelligence/backend<br />
            uvicorn main:app --port 8001 --reload
          </code>
        </div>
      )}

      {/* Results */}
      {status === "ready" && (
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="shrink-0 w-52 space-y-6 hidden md:block">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Sort by</h3>
              <div className="space-y-1">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setSortBy(opt.value)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-all ${sortBy === opt.value ? "bg-[#1B2B4B] text-white font-semibold" : "text-slate-600 hover:bg-slate-100"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Results grid */}
          <div className="flex-1 min-w-0">
            {results.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-5xl mb-4">🏨</p>
                <p className="font-semibold text-slate-600 text-lg">No hotels found</p>
                <p className="text-sm mt-1">The backend may still be collecting data. Check again in a moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.map((hotel, i) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    rank={i + 1}
                    saved={saved.has(hotel.id)}
                    onSave={toggleSave}
                    pendingReason={isQueryMode && streamingExplanations && !hotel.matchReason}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#1B2B4B] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}
