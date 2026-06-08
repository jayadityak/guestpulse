import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "GuestPulse — Find Hotels by What Guests Actually Experienced",
  description:
    "AI-powered hotel intelligence. We analyze thousands of real guest reviews to rank hotels by what actually matters to you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#FAFAF8] text-[#1B2B4B] antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
