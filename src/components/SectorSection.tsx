"use client";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { inr, num, pct, type Row, type Sector } from "@/lib/calc";
import type { Src } from "@/lib/types";

const Flash = memo(function Flash({ v, children }: { v: number | null; children: ReactNode }) {
  const prev = useRef(v);
  const [dir, setDir] = useState("");
  useEffect(() => {
    if (prev.current != null && v != null && v !== prev.current) {
      setDir(v > prev.current ? "flash-up" : "flash-down");
      const t = setTimeout(() => setDir(""), 1200);
      prev.current = v;
      return () => clearTimeout(t);
    }
    prev.current = v;
  }, [v]);
  return <span className={dir}>{children}</span>;
});

const SRC: Record<Src, [string, string]> = {
  live: ["bg-gain", "Live from source"], stale: ["bg-amber", "Source failed — showing last good value"], snapshot: ["bg-mute", "Source unavailable — showing Excel snapshot"],
};
const Dot = ({ s }: { s: Src }) => <span title={SRC[s][1]} aria-label={SRC[s][1]} className={`inline-block h-1.5 w-1.5 rounded-full ${SRC[s][0]}`} />;
const Tone = ({ v, children }: { v: number | null; children: ReactNode }) => <span className={v == null ? "" : v >= 0 ? "text-gain" : "text-loss"}>{children}</span>;

const c = createColumnHelper<Row>();
const columns = [
  c.accessor((r) => r.h.name, { id: "name", header: "Particulars", cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
  c.accessor((r) => r.h.buyPrice, { id: "buy", header: "Purchase Price", cell: (i) => inr(i.getValue()) }),
  c.accessor((r) => r.h.qty, { id: "qty", header: "Qty", cell: (i) => num(i.getValue(), 0) }),
  c.accessor("investment", { header: "Investment", cell: (i) => inr(i.getValue()) }),
  c.accessor("weight", { header: "Portfolio (%)", cell: (i) => (
    <div className="flex items-center justify-end gap-2"><span>{(i.getValue() * 100).toFixed(2)}%</span>
      <span className="h-1.5 w-12 overflow-hidden rounded bg-line"><span className="block h-full bg-amber" style={{ width: `${Math.min(100, i.getValue() * 1000)}%` }} /></span></div>) }),
  c.accessor((r) => r.h.code, { id: "code", header: "NSE/BSE", cell: (i) => <span className="text-mute">{i.getValue()} <span className="rounded bg-raise px-1 text-[10px]">{i.row.original.h.exchange}</span></span> }),
  c.accessor("cmp", { header: "CMP", cell: (i) => <span className="inline-flex items-center gap-1.5"><Dot s={i.row.original.src} /><Flash v={i.getValue()}>{inr(i.getValue())}</Flash></span> }),
  c.accessor("pv", { header: "Present Value", cell: (i) => <Flash v={i.getValue()}>{inr(i.getValue())}</Flash> }),
  c.accessor("gl", { header: "Gain/Loss", cell: (i) => { const r = i.row.original; if (r.gl == null) return "—";
    return <Tone v={r.gl}><span className="font-semibold">{r.gl >= 0 ? "▲" : "▼"} {inr(Math.abs(r.gl))}</span><span className="block text-xs opacity-80">{pct(r.glPct ?? 0)}</span></Tone>; } }),
  c.accessor("pe", { header: "P/E Ratio", cell: (i) => <span className="inline-flex items-center gap-1.5"><Dot s={i.row.original.fSrc} />{num(i.getValue())}</span> }),
  c.accessor("eps", { header: "Latest Earnings", cell: (i) => i.getValue() == null ? "—" : <span>{inr(i.getValue())}<span className="block text-xs text-mute">EPS / share</span></span> }),
];

export default memo(function SectorSection({ s }: { s: Sector }) {
  const [open, setOpen] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const t = useReactTable({ data: s.rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="grid w-full grid-cols-2 items-center gap-3 px-4 py-3 text-left hover:bg-raise md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div><h2 className="text-base font-semibold">{open ? "▾" : "▸"} {s.sector}</h2><p className="text-xs text-mute">{s.rows.length} holdings · {(s.weight * 100).toFixed(1)}% of portfolio</p></div>
        <div><p className="text-xs text-mute">Total investment</p><p className="font-medium">{inr(s.inv, 0)}</p></div>
        <div><p className="text-xs text-mute">Total present value</p><p className="font-medium">{inr(s.pv, 0)}</p></div>
        <div><p className="text-xs text-mute">Gain/Loss</p><Tone v={s.gl}><p className="font-semibold">{s.gl >= 0 ? "▲" : "▼"} {inr(Math.abs(s.gl), 0)} ({pct(s.glPct)})</p></Tone></div>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-raise text-xs text-mute">{t.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>{hg.headers.map((h) => (
                <th key={h.id} scope="col" aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : "none"}
                  className={`px-3 py-2 font-medium ${["name", "code"].includes(h.id) ? "text-left" : "text-right"} ${h.id === "name" ? "sticky left-0 bg-raise" : ""}`}>
                  <button onClick={h.column.getToggleSortingHandler()} className="hover:text-white">{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}</button>
                </th>))}</tr>))}
            </thead>
            <tbody>{t.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-t border-line/60 hover:bg-raise/60">{r.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`whitespace-nowrap px-3 py-2.5 ${["name", "code"].includes(cell.column.id) ? "text-left" : "text-right"} ${cell.column.id === "name" ? "sticky left-0 bg-panel" : ""}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}</td>))}</tr>))}
            </tbody>
          </table>
        </div>)}
    </section>
  );
});
