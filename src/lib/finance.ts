// Server-only data layer. Yahoo/Google have no official public API, so we use their public
// endpoints/pages server-side (nothing sensitive reaches the browser), with caching,
// request de-duplication, concurrency limits, timeouts and stale/snapshot fallbacks.
import raw from "@/data/portfolio.json";
import type { FundMap, Holding, PriceMap, Src } from "./types";

const holdings = raw as Holding[];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PRICE_TTL = 10_000;      // CMP cache: < 15s UI poll, so every poll gets near-fresh data but upstream is hit ~once per 10s
const FUND_TTL = 10 * 60_000;  // P/E & EPS change rarely: cache 10 min
const YAHOO_AUTH_TTL = 60 * 60_000;

type Store<T> = Map<string, { v: T; at: number }>;
type Metrics = { pe: number | null; eps: number | null };
type Fundamentals = Metrics & { errors: string[] };
type YahooAuth = { cookie: string; crumb: string; at: number };
const g = globalThis as unknown as { __p?: Store<number>; __f?: Store<Fundamentals>; __i?: Map<string, Promise<unknown>>; __ya?: YahooAuth };
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

async function yahooPriceWithAlt(h: Holding): Promise<number> {
  try { return await yahooPrice(h.yahoo); }
  catch (primaryError) {
    if (!h.yahooAlt) throw primaryError;
    try { return await yahooPrice(h.yahooAlt); }
    catch (alternateError) {
      throw new Error(`Yahoo ${h.yahoo} failed: ${msg(primaryError)}; alternate ${h.yahooAlt} failed: ${msg(alternateError)}`);
    }
  }
}

const toNum = (s?: string) => { if (!s) return null; const n = parseFloat(s.replace(/[,\s₹]/g, "")); return Number.isNaN(n) ? null : n; };

function valueBetween(text: string, label: string, endLabel: string) {
  const lower = text.toLowerCase();
  const start = lower.indexOf(label.toLowerCase());
  if (start < 0) return { found: false, value: null };
  const valueStart = start + label.length;
  const end = lower.indexOf(endLabel.toLowerCase(), valueStart);
  if (end < 0) return { found: true, value: null };
  const section = text.slice(valueStart, end);
  const match = section.match(/\|\s*(-?[\d,]+(?:\.\d+)?)\s*(?=\|)/);
  return { found: true, value: toNum(match?.[1]) };
}

async function googleFundamentals(tkr: string): Promise<Metrics> {
  const r = await fetch(`https://www.google.com/finance/quote/${tkr}?hl=en`, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html",
      "Accept-Language": "en-IN",
      "Cookie": "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg"
    }, cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`Google HTTP ${r.status}`);
  const html = await r.text();
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "unknown";
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, "|").replace(/\s+/g, " ");
  const pe = valueBetween(text, "P/E ratio", "Dividend yield");
  const eps = valueBetween(text, "Earnings per share", "EBITDA");
  if (!pe.found && !eps.found) throw new Error(`Google: fundamentals labels not found (page title: ${title})`);
  return { pe: pe.value, eps: eps.value };
}

async function yahooAuth(): Promise<YahooAuth> {
  const hit = g.__ya;
  if (hit && Date.now() - hit.at < YAHOO_AUTH_TTL) return hit;
  const key = "yahoo-auth";
  let pending = inflight.get(key) as Promise<YahooAuth> | undefined;
  if (!pending) {
    pending = (async () => {
      const cookieResponse = await fetch("https://fc.yahoo.com", {
        headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(8000)
      });
      const cookie = cookieResponse.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error(`Yahoo: cookie missing (HTTP ${cookieResponse.status})`);
      const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
        headers: { "User-Agent": UA, "Cookie": cookie }, cache: "no-store", signal: AbortSignal.timeout(8000)
      });
      if (!crumbResponse.ok) throw new Error(`Yahoo crumb HTTP ${crumbResponse.status}`);
      const crumb = (await crumbResponse.text()).trim();
      if (!crumb) throw new Error("Yahoo: empty crumb");
      const auth = { cookie, crumb, at: Date.now() };
      g.__ya = auth;
      return auth;
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

async function yahooFundamentals(tkr: string): Promise<Metrics> {
  const { cookie, crumb } = await yahooAuth();
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tkr)}&crumb=${encodeURIComponent(crumb)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Cookie": cookie, "Accept": "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`Yahoo quote HTTP ${r.status}`);
  const quote = (await r.json())?.quoteResponse?.result?.[0];
  const pe = typeof quote?.trailingPE === "number" && Number.isFinite(quote.trailingPE) ? quote.trailingPE : null;
  const eps = typeof quote?.epsTrailingTwelveMonths === "number" && Number.isFinite(quote.epsTrailingTwelveMonths)
    ? quote.epsTrailingTwelveMonths : null;
  if (pe === null && eps === null) throw new Error(`Yahoo: P/E and EPS not found for ${tkr}`);
  return { pe, eps };
}

async function loadFundamentals(h: Holding): Promise<Fundamentals> {
  let google: Metrics = { pe: null, eps: null };
  const errors: string[] = [];
  try { google = await googleFundamentals(h.google); }
  catch (e) { errors.push(`Google (${h.google}): ${msg(e)}`); }

  let yahoo: Metrics = { pe: null, eps: null };
  if (google.pe === null || google.eps === null) {
    try { yahoo = await yahooFundamentals(h.yahoo); }
    catch (e) { errors.push(`Yahoo (${h.yahoo}): ${msg(e)}`); }
  }
  const pe = google.pe ?? yahoo.pe;
  const eps = google.eps ?? yahoo.eps;
  if (pe === null && eps === null) throw new Error(errors.join("; ") || "Google and Yahoo returned no P/E or EPS");
  return { pe, eps, errors };
}

export async function getPrices() {
  const prices: PriceMap = {}; const errors: string[] = [];
  await pool(holdings, 8, async (h) => {
    try {
      const r = await cached(priceStore, h.yahoo, PRICE_TTL, () => yahooPriceWithAlt(h));
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
      const r = await cached(fundStore, h.google, FUND_TTL, () => loadFundamentals(h));
      funds[h.id] = { pe: r.v.pe ?? h.fallback.pe, eps: r.v.eps ?? h.fallback.eps, src: r.src };
      if (r.v.errors.length) errors.push(`${h.name}: ${r.v.errors.join("; ")}`);
    } catch (e) {
      funds[h.id] = { pe: h.fallback.pe, eps: h.fallback.eps, src: "snapshot" };
      errors.push(`${h.name} (${h.google}): ${msg(e)}`);
    }
  });
  return { funds, errors, updatedAt: Date.now() };
}
