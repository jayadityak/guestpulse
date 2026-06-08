"use client";
import Link from "next/link";
import { Star, MapPin, TrendingUp, AlertTriangle, Bookmark, ExternalLink } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, scoreColor, formatPrice } from "@/lib/utils";
import type { Hotel } from "@/lib/types";

interface HotelCardProps {
  hotel: Hotel;
  rank: number;
  saved?: boolean;
  onSave?: (id: string) => void;
  matchReason?: string;
  /** True while streaming: explanation hasn't arrived yet for this hotel */
  pendingReason?: boolean;
}

const SCORE_DIMS = [
  { key: "cleanliness" as const, label: "Clean" },
  { key: "service" as const, label: "Service" },
  { key: "location" as const, label: "Location" },
  { key: "noise" as const, label: "Quiet" },
  { key: "value" as const, label: "Value" },
];

export function HotelCard({ hotel, rank, saved, onSave, matchReason, pendingReason }: HotelCardProps) {
  const { analysis } = hotel;
  // Use hotel.matchReason from backend if the explicit prop isn't provided
  const reason = matchReason || hotel.matchReason;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all overflow-hidden group">
      {/* Image / header */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={hotel.imageUrl}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Rank badge */}
        <div className={cn(
          "absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full",
          rank === 1 ? "bg-amber-400 text-amber-900" :
          rank === 2 ? "bg-slate-200 text-slate-700" :
          rank === 3 ? "bg-orange-200 text-orange-700" :
          "bg-white/80 text-slate-700"
        )}>
          #{rank}
        </div>

        {/* Save button */}
        <button
          onClick={() => onSave?.(hotel.id)}
          className={cn(
            "absolute top-3 right-3 p-2 rounded-full transition-all",
            saved ? "bg-[#1B2B4B] text-white" : "bg-white/80 text-slate-600 hover:bg-white"
          )}
        >
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        </button>

        {/* Score ring */}
        <div className="absolute bottom-3 right-3">
          <div className="bg-white rounded-2xl px-3 py-2 shadow-lg text-center">
            <div className={cn("text-2xl font-black", scoreColor(analysis.guestPulseScore))}>
              {analysis.guestPulseScore}
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">GuestPulse</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[#1B2B4B] text-base leading-tight">{hotel.name}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            {Array.from({ length: hotel.starRating }).map((_, i) => (
              <Star key={i} size={11} fill="#f59e0b" className="text-amber-400" />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-500 text-xs mb-3">
          <MapPin size={11} />
          <span>{hotel.neighborhood}</span>
          <span className="text-slate-300">·</span>
          {hotel.pricePerNight > 0 ? (
            <span className="font-semibold text-[#1B2B4B]">~{formatPrice(hotel.pricePerNight)}/night</span>
          ) : (
            <span className="text-slate-400 italic">Check rates</span>
          )}
        </div>

        {/* Match reason banner (shown when NLP query was used) */}
        {reason && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
            <span className="text-emerald-500 text-sm shrink-0 mt-0.5">✦</span>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">{reason}</p>
          </div>
        )}

        {/* Pulsing skeleton while streaming explanation hasn't arrived yet */}
        {!reason && pendingReason && (
          <div className="flex items-center gap-2 bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2 mb-3 animate-pulse">
            <span className="text-emerald-400 text-sm shrink-0">✦</span>
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 bg-emerald-200/70 rounded-full w-full" />
              <div className="h-2.5 bg-emerald-200/70 rounded-full w-4/5" />
            </div>
          </div>
        )}

        {/* Summary */}
        {!reason && !pendingReason && (
          <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{analysis.summary}</p>
        )}
        {reason && (
          <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-1 italic">{analysis.summary}</p>
        )}
        {!reason && pendingReason && (
          <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-1 italic">{analysis.summary}</p>
        )}

        {/* Score bars */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {SCORE_DIMS.map(({ key, label }) => (
            <div key={key} className="text-center">
              <div className={cn("text-sm font-bold", scoreColor(analysis.scores[key]))}>
                {analysis.scores[key]}
              </div>
              <div className="text-[10px] text-slate-400">{label}</div>
              <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", analysis.scores[key] >= 85 ? "bg-emerald-500" : analysis.scores[key] >= 70 ? "bg-blue-500" : analysis.scores[key] >= 55 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${analysis.scores[key]}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Best for + risks */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2">
            <TrendingUp size={13} className="text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {analysis.bestFor.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="success" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </div>
          {analysis.topRisks[0] && (
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-[11px] text-slate-500 leading-tight">{analysis.topRisks[0]}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/hotels/${hotel.id}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full text-xs">
              View full analysis
            </Button>
          </Link>
          <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs gap-1">
              Book <ExternalLink size={11} />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
