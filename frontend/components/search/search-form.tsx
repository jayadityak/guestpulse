"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar, Users, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SearchParams, TripType } from "@/lib/types";

const TRIP_TYPES: { value: TripType; label: string; emoji: string }[] = [
  { value: "business", label: "Business", emoji: "💼" },
  { value: "couple", label: "Couple", emoji: "❤️" },
  { value: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { value: "solo", label: "Solo", emoji: "🧳" },
  { value: "luxury", label: "Luxury", emoji: "✨" },
  { value: "budget", label: "Budget", emoji: "💰" },
];

const PRIORITIES = [
  "Cleanliness", "Quiet rooms", "Location", "Service quality",
  "Breakfast", "WiFi", "Value for money", "Room size", "Safety",
];

export function SearchForm() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [budgetMin, setBudgetMin] = useState(50);
  const [budgetMax, setBudgetMax] = useState(500);
  const [tripType, setTripType] = useState<TripType | "">("");
  const [priorities, setPriorities] = useState<string[]>([]);

  function togglePriority(p: string) {
    setPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    const params = new URLSearchParams({
      city: city.trim(),
      checkIn,
      checkOut,
      guests: String(guests),
      budgetMin: String(budgetMin),
      budgetMax: String(budgetMax),
      tripType,
      priorities: priorities.join(","),
    });
    router.push(`/search?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 space-y-6">
      {/* Row 1: City + Dates + Guests */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destination</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="New York, Paris, Tokyo…"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B] transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Check-in</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B] transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Check-out</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Budget + Guests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Budget per night</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <DollarSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" placeholder="Min" value={budgetMin} onChange={(e) => setBudgetMin(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B]" />
            </div>
            <span className="text-slate-400">–</span>
            <div className="relative flex-1">
              <DollarSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="number" placeholder="Max" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B]" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Guests</label>
          <div className="relative">
            <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20 focus:border-[#1B2B4B] bg-white appearance-none">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? "adult" : "adults"}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Star rating</label>
          <div className="flex items-center gap-1 h-12">
            {[1,2,3,4,5].map(s => (
              <button key={s} type="button" className="p-1 text-amber-400 hover:scale-110 transition-transform">
                <Star size={20} fill="currentColor" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trip type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trip type</label>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTripType(tripType === value ? "" : value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                tripType === value
                  ? "bg-[#1B2B4B] text-white border-[#1B2B4B]"
                  : "bg-white text-slate-700 border-slate-200 hover:border-[#1B2B4B] hover:text-[#1B2B4B]"
              }`}
            >
              <span>{emoji}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Priorities */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">What matters most to you?</label>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                priorities.includes(p)
                  ? "bg-[#F5EFE6] text-[#7C6A52] border-[#E8DDD0]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="xl" variant="primary" className="w-full gap-3 text-base">
        <Search size={18} />
        Find Best Hotels
      </Button>
    </form>
  );
}
