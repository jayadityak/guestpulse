"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { MOCK_HOTELS } from "@/data/mock-hotels";
import { ScoreBar } from "@/components/ui/score-bar";
import { ScoreRing } from "@/components/ui/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MapPin, ExternalLink, TrendingUp, AlertTriangle, ThumbsUp, ThumbsDown, Repeat } from "lucide-react";
import Link from "next/link";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { scoreColor, formatPrice } from "@/lib/utils";

export default function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hotel = MOCK_HOTELS.find((h) => h.id === id);
  if (!hotel) notFound();

  const { analysis } = hotel;

  const radarData = [
    { subject: "Cleanliness", value: analysis.scores.cleanliness },
    { subject: "Service", value: analysis.scores.service },
    { subject: "Location", value: analysis.scores.location },
    { subject: "Quiet", value: analysis.scores.noise },
    { subject: "Food", value: analysis.scores.food },
    { subject: "Value", value: analysis.scores.value },
    { subject: "Room", value: analysis.scores.roomQuality },
    { subject: "Upkeep", value: analysis.scores.maintenance },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link href="/search" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1B2B4B] mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to results
      </Link>

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-8 h-64 md:h-80">
        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex">
                  {Array.from({ length: hotel.starRating }).map((_, i) => (
                    <Star key={i} size={14} fill="#f59e0b" className="text-amber-400" />
                  ))}
                </div>
                {analysis.bestFor.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs font-medium bg-white/15 text-white px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
              <h1 className="text-white text-3xl md:text-4xl font-bold mb-1">{hotel.name}</h1>
              <div className="flex items-center gap-3 text-white/80 text-sm">
                <span className="flex items-center gap-1"><MapPin size={13} />{hotel.neighborhood}</span>
                <span className="font-semibold text-white">{formatPrice(hotel.pricePerNight)}/night</span>
                <span>{hotel.totalReviews.toLocaleString()} reviews</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-xl shrink-0">
              <div className={`text-4xl font-black ${scoreColor(analysis.guestPulseScore)}`}>{analysis.guestPulseScore}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">GuestPulse<br />Score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Verdict */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="font-bold text-[#1B2B4B] text-lg mb-4">AI Verdict</h2>
            <p className="text-slate-600 leading-relaxed mb-5 text-sm">{analysis.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1"><TrendingUp size={12} /> Choose this hotel if…</div>
                <ul className="space-y-1">
                  {analysis.bestFor.map(b => <li key={b} className="text-sm text-emerald-800 flex items-start gap-1.5"><span className="mt-0.5">✓</span>{b}</li>)}
                </ul>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Avoid if…</div>
                <ul className="space-y-1">
                  {analysis.avoidIf.map(a => <li key={a} className="text-sm text-red-800 flex items-start gap-1.5"><span className="mt-0.5">✗</span>{a}</li>)}
                </ul>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="font-bold text-[#1B2B4B] text-lg mb-5">Score Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ScoreBar label="Cleanliness" score={analysis.scores.cleanliness} />
              <ScoreBar label="Service" score={analysis.scores.service} />
              <ScoreBar label="Location" score={analysis.scores.location} />
              <ScoreBar label="Quiet / Noise" score={analysis.scores.noise} />
              <ScoreBar label="Food & Dining" score={analysis.scores.food} />
              <ScoreBar label="Value for Money" score={analysis.scores.value} />
              <ScoreBar label="Room Quality" score={analysis.scores.roomQuality} />
              <ScoreBar label="Maintenance" score={analysis.scores.maintenance} />
            </div>
          </div>

          {/* Review themes */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="font-bold text-[#1B2B4B] text-lg mb-5">What Guests Talk About</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp size={15} className="text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-700">Consistently Praised</span>
                </div>
                <div className="space-y-3">
                  {analysis.positiveThemes.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg h-fit">{t.frequency}×</div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{t.theme}</div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown size={15} className="text-red-500" />
                  <span className="text-sm font-bold text-red-700">Recurring Complaints</span>
                </div>
                <div className="space-y-3">
                  {analysis.negativeThemes.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-lg h-fit">{t.frequency}×</div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{t.theme}</div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Repeated complaints */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Repeat size={15} className="text-amber-500" />
              <h2 className="font-bold text-[#1B2B4B] text-lg">Repeated Guest Complaints</h2>
            </div>
            <div className="space-y-2">
              {analysis.repeatedComplaints.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <span className="text-amber-500 text-sm">⚠</span>
                  <span className="text-sm text-slate-700">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Radar chart */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-[#1B2B4B] mb-4 text-sm">Performance Radar</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#64748b" }} />
                <Radar dataKey="value" stroke="#1B2B4B" fill="#1B2B4B" fillOpacity={0.12} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Final verdict */}
          <div className="bg-[#1B2B4B] rounded-2xl p-6">
            <div className="text-white/60 text-xs font-bold uppercase tracking-wide mb-3">Final Verdict</div>
            <p className="text-white text-sm leading-relaxed">{analysis.finalVerdict}</p>
          </div>

          {/* Strengths / risks */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <div>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">Top Strengths</div>
              <ul className="space-y-1.5">
                {analysis.topStrengths.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500 font-bold">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Key Risks</div>
              <ul className="space-y-1.5">
                {analysis.topRisks.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-red-500 font-bold">−</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Booking */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
            <div className="text-sm font-bold text-slate-700">Book this hotel</div>
            <div className="text-2xl font-black text-[#1B2B4B]">{formatPrice(hotel.pricePerNight)}<span className="text-sm font-normal text-slate-400">/night</span></div>
            <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="primary" className="w-full gap-2">
                Book on Booking.com <ExternalLink size={14} />
              </Button>
            </a>
            <p className="text-[10px] text-slate-400 text-center">Prices may vary. Always confirm on the booking site.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
