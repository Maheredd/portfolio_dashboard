// Server-only data layer. Yahoo/Google have no official public API, so we use their public
// endpoints/pages server-side (nothing sensitive reaches the browser), with caching,
// request de-duplication, concurrency limits, timeouts and stale/snapshot fallbacks.
import raw from "@/data/portfolio.json";
import type { FundMap, Holding, PriceMap, Src } from "./types";

const holdings = raw as Holding[];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PRICE_TTL = 10_000;      // CMP cache: < 15s UI poll, so every poll gets near-fresh data but upstream is hit ~once per 10s
const FUND_TTL = 10 * 60_000;  // P/E & EPS change rarely: cache 10 min

type Store<T> = Map<string, { v: T; at: number }>;
const g = globalThis as unknown as { __p?: Store<number>; __f?: Store<{ pe: number | null; eps: number | null }>; __i?: Map<string, Promise<unknown>> };
const priceStore = (g.__p ??= new Map());
const fundStore = (g.__f ??= new Map());
const inflight = (g.__i ??= new Map());

async function cached<T>(store: Store<T>, key: string, ttl: number, fn: () => Promise<T>): Promise<{ v: T; src: Src; at: number }> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return { ...hit, src: "live" };
  try {
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) { p = fn().finally(() => inflight.delete(key)); inflight.set(key, p); }
    const v = await p;
    const at = Date.now();
    store.set(key, { v, at });
    return { v, src: "live", at };
  } catch (e) {
    if (hit) return { ...hit, src: "stale" }; // serve last good value if upstream fails
    throw e;
  }
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x; x = q.shift()) await fn(x); }));
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function yahooPrice(sym: string): Promise<number> {
  let last: unknown;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`,
        { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
      const p = (await r.json())?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof p !== "number") throw new Error("Yahoo: no price in response");
      return p;
    } catch (e) { last = e; }
  }
  throw last;
}

const toNum = (s?: string) => { if (!s) return null; const n = parseFloat(s.replace(/[,\s₹]/g, "")); return Number.isNaN(n) ? null : n; };

async function googleFundamentals(tkr: string) {
  const r = await fetch(`https://www.google.com/finance/quote/${tkr}?hl=en`,
    { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Google HTTP ${r.status}`);
  const html = await r.text();
  const pe = toNum(html.match(/P\/E ratio[\s\S]{0,600}?class="P6K39c">([^<]+)</)?.[1]);
  const eps = toNum(html.match(/Earnings per share<\/div>[\s\S]{0,400}?class="QXDnM">([^<]+)</)?.[1]);
  if (pe === null && eps === null) throw new Error("Google: P/E & EPS not found (page layout changed or consent page)");
  return { pe, eps };
}

export async function getPrices() {
  const prices: PriceMap = {}; const errors: string[] = [];
  await pool(holdings, 8, async (h) => {
    try {
      const r = await cached(priceStore, h.yahoo, PRICE_TTL, () => yahooPrice(h.yahoo));
      prices[h.id] = { cmp: r.v, src: r.src, at: r.at };
    } catch (e) {
      prices[h.id] = { cmp: h.fallback.cmp, src: "snapshot", at: null };
      errors.push(`${h.name} (${h.yahoo}): ${msg(e)}`);
    }
  });
  return { prices, errors, updatedAt: Date.now() };
}

export async function getFundamentals() {
  const funds: FundMap = {}; const errors: string[] = [];
  await pool(holdings, 5, async (h) => {
    try {
      const r = await cached(fundStore, h.google, FUND_TTL, () => googleFundamentals(h.google));
      funds[h.id] = { pe: r.v.pe ?? h.fallback.pe, eps: r.v.eps ?? h.fallback.eps, src: r.src };
    } catch (e) {
      funds[h.id] = { pe: h.fallback.pe, eps: h.fallback.eps, src: "snapshot" };
      errors.push(`${h.name} (${h.google}): ${msg(e)}`);
    }
  });
  return { funds, errors, updatedAt: Date.now() };
}
