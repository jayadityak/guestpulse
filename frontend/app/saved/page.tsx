"use client";
import { useState, useEffect } from "react";
import { MOCK_HOTELS } from "@/data/mock-hotels";
import { ScoreBar } from "@/components/ui/score-bar";
import { Bookmark, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatPrice, scoreColor } from "@/lib/utils";
import type { Hotel } from "@/lib/types";

const DEMO_SAVED = ["nyc-1", "nyc-5", "par-2", "par-10"];

const COMPARE_DIMS = [
  { key: "guestPulseScore" as const, label: "GuestPulse Score", fromAnalysis: false },
  { key: "cleanliness" as const, label: "Cleanliness", fromAnalysis: true },
  { key: "service" as const, label: "Service", fromAnalysis: true },
  { key: "location" as const, label: "Location", fromAnalysis: true },
  { key: "noise" as const, label: "Quiet", fromAnalysis: true },
  { key: "value" as const, label: "Value", fromAnalysis: true },
];

export default function SavedPage() {
  const [savedIds, setSavedIds] = useState<string[]>(DEMO_SAVED);
  const hotels = MOCK_HOTELS.filter((h) => savedIds.includes(h.id));

  function remove(id: string) {
    setSavedIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bookmark size={22} className="text-[#1B2B4B]" />
          <h1 className="text-2xl font-bold text-[#1B2B4B]">Saved Hotels</h1>
        </div>
        <p className="text-slate-500 text-sm">{hotels.length} hotels saved · Compare side by side</p>
      </div>

      {hotels.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🏨</p>
          <p className="font-semibold text-slate-600 text-lg">No saved hotels yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">Save hotels from search results to compare them here</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[#1B2B4B] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#243560] transition-colors">
            Search hotels <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          {/* Saved cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {hotels.map((hotel) => (
              <div key={hotel.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="relative h-32 overflow-hidden">
                  <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <button onClick={() => remove(hotel.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                  <div className="absolute bottom-2 left-2">
                    <span className={`text-xl font-black ${scoreColor(hotel.analysis.guestPulseScore)}`}>
                      {hotel.analysis.guestPulseScore}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-[#1B2B4B] text-sm leading-tight mb-0.5">{hotel.name}</h3>
                  <p className="text-xs text-slate-500 mb-2">{hotel.city} · {formatPrice(hotel.pricePerNight)}/night</p>
                  <Link href={`/hotels/${hotel.id}`} className="text-xs font-semibold text-[#1B2B4B] hover:underline">
                    View analysis →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-[#1B2B4B] text-lg">Side-by-Side Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wide w-36">Metric</th>
                    {hotels.map((h) => (
                      <th key={h.id} className="p-4 text-center min-w-[140px]">
                        <div className="text-sm font-bold text-[#1B2B4B] leading-tight">{h.name}</div>
                        <div className="text-xs text-slate-400">{h.city}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price */}
                  <tr className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 text-sm font-semibold text-slate-600">Price/night</td>
                    {hotels.map((h) => (
                      <td key={h.id} className="p-4 text-center text-sm font-bold text-[#1B2B4B]">{formatPrice(h.pricePerNight)}</td>
                    ))}
                  </tr>
                  {/* GuestPulse score */}
                  <tr className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 text-sm font-semibold text-slate-600">GuestPulse</td>
                    {hotels.map((h) => {
                      const best = Math.max(...hotels.map(x => x.analysis.guestPulseScore));
                      return (
                        <td key={h.id} className="p-4 text-center">
                          <span className={`text-lg font-black ${scoreColor(h.analysis.guestPulseScore)}`}>{h.analysis.guestPulseScore}</span>
                          {h.analysis.guestPulseScore === best && <span className="ml-1 text-amber-400 text-xs">★</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Dimension scores */}
                  {(["cleanliness","service","location","noise","value","food"] as const).map((dim) => {
                    const best = Math.max(...hotels.map(h => h.analysis.scores[dim]));
                    const labels: Record<string,string> = { cleanliness:"Cleanliness", service:"Service", location:"Location", noise:"Quiet", value:"Value", food:"Food" };
                    return (
                      <tr key={dim} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-4 text-sm font-semibold text-slate-600">{labels[dim]}</td>
                        {hotels.map((h) => (
                          <td key={h.id} className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={`text-sm font-bold w-8 text-right ${scoreColor(h.analysis.scores[dim])}`}>{h.analysis.scores[dim]}</div>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${h.analysis.scores[dim] >= 85 ? "bg-emerald-500" : h.analysis.scores[dim] >= 70 ? "bg-blue-500" : "bg-amber-500"}`}
                                  style={{ width: `${h.analysis.scores[dim]}%` }} />
                              </div>
                              {h.analysis.scores[dim] === best && <span className="text-amber-400 text-xs">★</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Best for */}
                  <tr className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 text-sm font-semibold text-slate-600">Best for</td>
                    {hotels.map((h) => (
                      <td key={h.id} className="p-4 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {h.analysis.bestFor.slice(0,2).map(b => (
                            <span key={b} className="text-[10px] bg-[#F5EFE6] text-[#7C6A52] px-2 py-0.5 rounded-full font-medium">{b}</span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {/* Biggest risk */}
                  <tr className="hover:bg-slate-50">
                    <td className="p-4 text-sm font-semibold text-slate-600">Biggest risk</td>
                    {hotels.map((h) => (
                      <td key={h.id} className="p-4 text-center text-xs text-red-600">{h.analysis.topRisks[0]}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
