"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const EXAMPLE_PROMPTS = [
  { label: "Badgers game weekend 🏈", query: "Coming for a Badgers game weekend with friends, want to be near campus or downtown, clean and lively, budget around $150/night" },
  { label: "Conference at Monona Terrace 💼", query: "Business conference at Monona Terrace, need fast WiFi, quiet room, easy check-in, under $250/night" },
  { label: "Romantic weekend 🌹", query: "Romantic weekend with my partner, want something upscale with nice dining, downtown Madison, around $200-300/night" },
  { label: "UW family visit 🚗", query: "Visiting our kid at UW-Madison with the family, need parking, comfortable rooms, close to campus, reasonable price" },
];

export function NlpSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {/* Text area */}
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="Tell us about your visit — why you're coming to Madison, budget, what matters most to you…"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[#1B2B4B] text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/30 shadow-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
          }}
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="absolute bottom-3 right-3 flex items-center gap-2 bg-[#1B2B4B] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#243a63] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Search size={14} />
          Find Hotels
        </button>
      </div>

      {/* Example chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-slate-400 self-center">Try:</span>
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setQuery(p.query)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-[#F5EFE6] hover:border-[#1B2B4B]/20 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>
    </form>
  );
}
