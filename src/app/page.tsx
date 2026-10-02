"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import raw from "@/data/portfolio.json";
import type { FundMap, Holding, PriceMap } from "@/lib/types";
import { buildRows, groupBySector, inr, marketStatus, pct, summarize } from "@/lib/calc";
import SectorSection from "@/components/SectorSection";
import Countdown from "@/components/Countdown";

const Charts = dynamic(() => import("@/components/Charts"), { ssr: false, loading: () => <div className="h-72" /> });
const holdings = raw as Holding[];
const PRICE_MS = 15_000, FUND_MS = 10 * 60_000;
const timeFmt = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour12: true });

export default function Page() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [funds, setFunds] = useState<FundMap>({});
  const [pErr, setPErr] = useState<string[]>([]);
  const [fErr, setFErr] = useState<string[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [nextAt, setNextAt] = useState(() => Date.now() + PRICE_MS);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "gain" | "loss">("all");
  const [showErr, setShowErr] = useState(false);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/prices", { cache: "no-store" });
      if (!r.ok) throw new Error(`Server responded with ${r.status}`);
      const j = await r.json();
      setPrices(j.prices); setPErr(j.errors); setUpdatedAt(j.updatedAt); setFatal(null);
    } catch (e) { setFatal(e instanceof Error ? e.message : "Network error"); }
    finally { setLoading(false); setNextAt(Date.now() + PRICE_MS); setOpen(marketStatus()); }
  }, []);

  useEffect(() => { if (paused) return; loadPrices(); const t = setInterval(loadPrices, PRICE_MS); return () => clearInterval(t); }, [paused, loadPrices]);

  useEffect(() => {
    const go = async () => {
      try { const r = await fetch("/api/fundamentals"); if (!r.ok) throw new Error(); const j = await r.json(); setFunds(j.funds); setFErr(j.errors); }
      catch { setFErr(["Could not reach /api/fundamentals — showing Excel snapshot for P/E and earnings."]); }
    };
    go(); const t = setInterval(go, FUND_MS); return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => buildRows(holdings, prices, funds), [prices, funds]);
  const total = useMemo(() => summarize(rows), [rows]);
  const sectors = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = rows.filter((r) => (!needle || r.h.name.toLowerCase().includes(needle) || r.h.code.toLowerCase().includes(needle))
      && (view === "all" || (view === "gain" ? (r.gl ?? 0) >= 0 : (r.gl ?? 0) < 0)));
    return groupBySector(f, total.inv);
  }, [rows, q, view, total.inv]);
  const allSectors = useMemo(() => groupBySector(rows, total.inv), [rows, total.inv]);
  const ranked = useMemo(() => [...rows].filter((r) => r.glPct != null).sort((a, b) => b.glPct! - a.glPct!), [rows]);
  const best = ranked[0], worst = ranked[ranked.length - 1];
  const live = rows.filter((r) => r.src === "live").length;
  const errors = [...pErr, ...fErr];
  const up = total.gl >= 0;

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-line bg-panel p-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-mute">
            <span className={`h-2 w-2 rounded-full ${fatal ? "bg-loss" : live ? "bg-gain live-dot" : "bg-amber"}`} />
            {fatal ? "Offline" : live ? `Live · ${live}/${rows.length} prices` : "Using Excel snapshot"}
            {open !== null && <span className="rounded bg-raise px-2 py-0.5 text-xs">{open ? "Market open" : "Market closed — last traded prices"}</span>}
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{inr(total.pv)}</h1>
          <p className={`mt-1 text-lg font-semibold ${up ? "text-gain" : "text-loss"}`}>{up ? "▲" : "▼"} {inr(Math.abs(total.gl))} ({pct(total.glPct)})
            <span className="ml-2 text-sm font-normal text-mute">on {inr(total.inv, 0)} invested</span></p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-mute"><p>{updatedAt ? `Updated ${timeFmt(updatedAt)}` : "Fetching prices…"}</p><p>{paused ? "Auto-refresh paused" : "Refreshes every 15s"}</p></div>
          <Countdown nextAt={nextAt} total={PRICE_MS} loading={loading} paused={paused} />
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setPaused(!paused)} className="rounded-md border border-line px-3 py-1 text-sm hover:bg-raise">{paused ? "Resume" : "Pause"}</button>
            <button onClick={loadPrices} disabled={loading} className="rounded-md bg-amber px-3 py-1 text-sm font-semibold text-ink disabled:opacity-50">Refresh now</button>
          </div>
        </div>
      </header>

      {fatal && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-loss/50 bg-loss/10 px-4 py-3 text-sm">
        <span><b>Couldn&apos;t refresh prices:</b> {fatal}. Showing the last values we have; retrying automatically.</span>
        <button onClick={loadPrices} className="rounded border border-loss/60 px-3 py-1">Retry</button></div>}
      {!fatal && errors.length > 0 && <div role="status" className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
        <button onClick={() => setShowErr(!showErr)} className="text-left"><b>{errors.length} data source{errors.length > 1 ? "s" : ""} unavailable.</b> Those rows show the last good value or the Excel snapshot (grey/amber dot). {showErr ? "Hide" : "Details"}</button>
        {showErr && <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-mute">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Holdings", `${rows.length} across ${allSectors.length} sectors`, ""],
          ["Total invested", inr(total.inv, 0), ""],
          ["Best performer", best ? `${best.h.name} ${pct(best.glPct!)}` : "—", "text-gain"],
          ["Weakest performer", worst ? `${worst.h.name} ${pct(worst.glPct!)}` : "—", "text-loss"]].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-line bg-panel px-4 py-3"><p className="text-xs text-mute">{l}</p><p className={`mt-0.5 font-semibold ${c}`}>{v}</p></div>))}
      </div>

      <Charts sectors={allSectors} />

      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock or code" aria-label="Search holdings"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm placeholder:text-mute md:w-72" />
        <div className="flex overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label="Filter by performance">
          {(["all", "gain", "loss"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-2 ${view === v ? "bg-raise font-semibold" : "hover:bg-raise/60"}`}>{{ all: "All", gain: "In profit", loss: "In loss" }[v]}</button>))}
        </div>
      </div>

      {sectors.length === 0 ? <p className="rounded-xl border border-line bg-panel p-8 text-center text-mute">No holdings match. Clear the search or switch the filter to All.</p>
        : <div className="space-y-4">{sectors.map((s) => <SectorSection key={s.sector} s={s} />)}</div>}

      <footer className="pb-6 text-xs text-mute">
        CMP comes from Yahoo Finance and P/E and earnings (EPS) from Google Finance through unofficial, scraped endpoints, so values can lag or differ from your broker. Not investment advice.
        Dots: green = live, amber = last good value, grey = Excel snapshot.
      </footer>
    </main>
  );
}
