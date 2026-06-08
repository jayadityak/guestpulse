"use client";
import { cn, scoreColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { outer: 52, stroke: 4, fontSize: "text-sm font-bold" },
  md: { outer: 72, stroke: 5, fontSize: "text-lg font-bold" },
  lg: { outer: 96, stroke: 6, fontSize: "text-2xl font-bold" },
};

export function ScoreRing({ score, size = "md", className }: ScoreRingProps) {
  const { outer, stroke, fontSize } = sizes[size];
  const r = (outer - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  const color =
    score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#ef4444";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={outer} height={outer} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={outer / 2} cy={outer / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={outer / 2} cy={outer / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn("absolute", fontSize, scoreColor(score))}>{score}</span>
    </div>
  );
}
