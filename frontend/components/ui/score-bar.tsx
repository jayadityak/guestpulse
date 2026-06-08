"use client";
import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  score: number;
  className?: string;
}

export function ScoreBar({ label, score, className }: ScoreBarProps) {
  const color =
    score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-blue-500" : score >= 55 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-bold text-slate-800">{score}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
