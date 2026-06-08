import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 55) return "text-amber-600";
  return "text-red-500";
}

export function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-50 border-emerald-200";
  if (score >= 70) return "bg-blue-50 border-blue-200";
  if (score >= 55) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 50) return "Average";
  return "Below Average";
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}
