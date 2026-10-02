export type Src = "live" | "stale" | "snapshot";
export interface Holding {
  id: string; name: string; sector: string; buyPrice: number; qty: number;
  code: string; exchange: "NSE" | "BSE"; yahoo: string; google: string;
  fallback: { cmp: number | null; pe: number | null; eps: number | null };
}
export type PriceMap = Record<string, { cmp: number | null; src: Src; at: number | null }>;
export type FundMap = Record<string, { pe: number | null; eps: number | null; src: Src }>;
