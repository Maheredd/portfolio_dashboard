"use client";
import { memo, useEffect, useState } from "react";

// Isolated so its 250ms tick never re-renders the tables.
export default memo(function Countdown({ nextAt, total, loading, paused }: { nextAt: number; total: number; loading: boolean; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, nextAt - now), C = 2 * Math.PI * 22;
  const frac = paused ? 1 : left / total;
  return (
    <div className="relative h-14 w-14 shrink-0" role="timer" aria-label={paused ? "Auto refresh paused" : `Next refresh in ${Math.ceil(left / 1000)} seconds`}>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#26324d" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" stroke={paused ? "#8b97b3" : "#f5b544"} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className={loading ? "live-dot" : ""} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold">{paused ? "❚❚" : loading ? "…" : Math.ceil(left / 1000)}</span>
    </div>
  );
});
