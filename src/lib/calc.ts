import type { FundMap, Holding, PriceMap, Src } from "./types";

export interface Row {
  h: Holding; cmp: number | null; src: Src; investment: number; weight: number;
  pv: number | null; gl: number | null; glPct: number | null; pe: number | null; eps: number | null; fSrc: Src;
}
export interface Sector { sector: string; rows: Row[]; inv: number; pv: number; gl: number; glPct: number; weight: number }

export const inr = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
export const num = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : new Intl.NumberFormat("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
export const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(2)}%`;

export function buildRows(hs: Holding[], prices: PriceMap, funds: FundMap): Row[] {
  const total = hs.reduce((s, h) => s + h.buyPrice * h.qty, 0);
  return hs.map((h) => {
    const p = prices[h.id], f = funds[h.id];
    const cmp = p?.cmp ?? h.fallback.cmp;
    const investment = h.buyPrice * h.qty;
    const pv = cmp == null ? null : cmp * h.qty;
    const gl = pv == null ? null : pv - investment;
    return { h, cmp, src: p?.src ?? "snapshot", investment, weight: investment / total, pv, gl, glPct: gl == null ? null : gl / investment,
             pe: f ? f.pe : h.fallback.pe, eps: f ? f.eps : h.fallback.eps, fSrc: f?.src ?? "snapshot" };
  });
}

export function summarize(rows: Row[]) {
  const inv = rows.reduce((s, r) => s + r.investment, 0);
  const pv = rows.reduce((s, r) => s + (r.pv ?? r.investment), 0);
  return { inv, pv, gl: pv - inv, glPct: inv ? (pv - inv) / inv : 0, weight: 0 };
}

export function groupBySector(rows: Row[], totalInv: number): Sector[] {
  const m = new Map<string, Row[]>();
  rows.forEach((r) => m.set(r.h.sector, [...(m.get(r.h.sector) ?? []), r]));
  return [...m].map(([sector, rs]) => { const s = summarize(rs); return { sector, rows: rs, ...s, weight: s.inv / totalInv }; });
}

export function marketStatus() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return !["Sat", "Sun"].includes(get("weekday")) && mins >= 555 && mins <= 930; // NSE/BSE 09:15–15:30 IST
}
