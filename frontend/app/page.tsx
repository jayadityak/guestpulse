import { NlpSearchForm } from "@/components/search/nlp-search-form";
import { CheckCircle, Zap, BarChart3, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

const HOW_IT_WORKS = [
  { step: "01", title: "Describe your trip", description: "Just tell us in plain English — why you're coming to Madison, what matters to you, your budget. No forms to fill out." },
  { step: "02", title: "AI reads real reviews", description: "We've analyzed hundreds of real guest reviews for every Madison hotel — from Google Maps, TripAdvisor, and Booking.com." },
  { step: "03", title: "Personalized matching", description: "Claude AI maps your specific needs to hotel profiles — Badgers game vs. conference vs. romantic trip all get different rankings." },
  { step: "04", title: "See why each hotel fits", description: "Every result comes with a one-sentence explanation of why it's a good match for exactly what you described." },
];

const FEATURES = [
  { icon: Zap, title: "AI Review Intelligence", description: "Claude AI reads thousands of reviews and extracts structured insights — not just star averages." },
  { icon: BarChart3, title: "8-Dimension Scoring", description: "Every hotel scored on cleanliness, service, location, noise, food, value, room quality, and maintenance." },
  { icon: Shield, title: "Complaint Detection", description: "We surface what guests complain about repeatedly — the things hotels don't advertise." },
  { icon: CheckCircle, title: "Personalized Ranking", description: "Scores are weighted to your trip type — business, family, romance, or budget all get different rankings." },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5EFE6]/40 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[#F5EFE6] text-[#7C6A52] text-xs font-semibold px-4 py-2 rounded-full border border-[#E8DDD0]">
              <Zap size={12} />
              AI-powered · Madison, Wisconsin
            </div>
          </div>
          <h1 className="text-center text-4xl md:text-6xl font-bold text-[#1B2B4B] leading-[1.1] tracking-tight mb-6">
            Find the perfect Madison hotel<br />
            <span className="text-[#7C6A52]">just tell us what you need</span>
          </h1>
          <p className="text-center text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Skip the forms. Describe your trip in plain English and our AI matches you to
            the best Madison hotel based on what real guests say.
          </p>
          <NlpSearchForm />
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#7C6A52] uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B2B4B]">From search to insight in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step}>
                <div className="text-5xl font-black text-slate-100 mb-4">{step}</div>
                <h3 className="text-base font-bold text-[#1B2B4B] mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample card */}
      <section className="py-24 bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#7C6A52] uppercase tracking-widest mb-3">Sample result</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B2B4B]">This is what you get for every hotel</h2>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden max-w-3xl mx-auto">
            <div className="h-48 bg-gradient-to-br from-[#1B2B4B] to-[#243560] relative p-6 flex items-end">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#F5EFE6] text-xs font-semibold bg-white/10 px-3 py-1 rounded-full">#1 Best Overall</span>
                  <span className="text-[#F5EFE6] text-xs font-semibold bg-white/10 px-3 py-1 rounded-full">★★★★★</span>
                </div>
                <h3 className="text-white text-2xl font-bold">The Bryant Park Grand</h3>
                <p className="text-white/70 text-sm">Midtown, New York · $420/night</p>
              </div>
              <div className="absolute top-6 right-6 bg-white rounded-2xl p-3 text-center shadow-lg">
                <div className="text-3xl font-black text-emerald-600">91</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">GuestPulse</div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">A flagship Midtown property with exceptional service and a prime location steps from Bryant Park. Consistently praised for spotless rooms and attentive staff.</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ label: "Cleanliness", score: 94 }, { label: "Service", score: 93 }, { label: "Location", score: 96 }].map(({ label, score }) => (
                  <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-lg font-bold text-[#1B2B4B]">{score}</div>
                    <div className="text-[11px] text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {["Business travelers", "Couples", "Luxury"].map(tag => (
                  <span key={tag} className="text-xs font-medium bg-[#F5EFE6] text-[#7C6A52] px-3 py-1 rounded-full">Best for {tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#7C6A52] uppercase tracking-widest mb-3">Why GuestPulse</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B2B4B]">Built different from any travel site</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 rounded-2xl border border-slate-100 hover:border-[#E8DDD0] hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-[#F5EFE6] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#1B2B4B] transition-colors">
                  <Icon size={18} className="text-[#7C6A52] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-[#1B2B4B] mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#1B2B4B]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to find your perfect hotel?</h2>
          <p className="text-slate-300 mb-8 text-lg">Stop reading hundreds of reviews yourself. Let AI do it for you.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-white text-[#1B2B4B] font-bold px-8 py-4 rounded-2xl hover:bg-[#F5EFE6] transition-colors text-base">
            Start searching <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="bg-[#1B2B4B] border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">GP</span>
            </div>
            <span className="text-white/70 text-sm">GuestPulse</span>
          </div>
          <p className="text-white/40 text-xs">AI-generated insights for informational purposes. Always verify before booking.</p>
        </div>
      </footer>
    </main>
  );
}
