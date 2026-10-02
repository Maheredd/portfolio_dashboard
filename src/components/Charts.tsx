"use client";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr, type Sector } from "@/lib/calc";

const COLORS = ["#5b8def", "#2bd48a", "#f5b544", "#b77bff", "#ff8a5c", "#4fd1d9"];
const tip = { contentStyle: { background: "#1b2540", border: "1px solid #26324d", borderRadius: 8, color: "#e2e8f0" }, itemStyle: { color: "#e2e8f0" } };

export default function Charts({ sectors }: { sectors: Sector[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="rounded-xl border border-line bg-panel p-4">
        <figcaption className="mb-2 text-sm font-semibold">Where the money sits (present value by sector)</figcaption>
        <div className="h-60"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={sectors} dataKey="pv" nameKey="sector" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none" label={(d) => d.sector}>
            {sectors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
            <Tooltip {...tip} formatter={(v: number) => inr(v, 0)} /></PieChart></ResponsiveContainer></div>
      </figure>
      <figure className="rounded-xl border border-line bg-panel p-4">
        <figcaption className="mb-2 text-sm font-semibold">Gain/Loss by sector</figcaption>
        <div className="h-60"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={sectors}><XAxis dataKey="sector" stroke="#8b97b3" fontSize={12} tickLine={false} /><YAxis stroke="#8b97b3" fontSize={12} tickLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip {...tip} cursor={{ fill: "#1b2540" }} formatter={(v: number) => inr(v, 0)} />
            <Bar dataKey="gl" name="Gain/Loss" radius={[4, 4, 0, 0]}>{sectors.map((s, i) => <Cell key={i} fill={s.gl >= 0 ? "#2bd48a" : "#ff5c6c"} />)}</Bar></BarChart></ResponsiveContainer></div>
      </figure>
    </div>
  );
}
