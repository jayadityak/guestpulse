"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1B2B4B] rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">GP</span>
          </div>
          <span className="font-bold text-[#1B2B4B] text-lg tracking-tight">GuestPulse</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className={cn("text-sm font-medium transition-colors hover:text-[#1B2B4B]", path === "/" ? "text-[#1B2B4B]" : "text-slate-500")}>
            Home
          </Link>
          <Link href="/saved" className={cn("text-sm font-medium transition-colors hover:text-[#1B2B4B]", path === "/saved" ? "text-[#1B2B4B]" : "text-slate-500")}>
            Saved Hotels
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/saved" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#1B2B4B] transition-colors">
            <Bookmark size={16} />
            <span className="hidden sm:inline">Saved</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 bg-[#1B2B4B] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#243560] transition-colors">
            <Search size={14} />
            Search
          </Link>
        </div>
      </div>
    </header>
  );
}
