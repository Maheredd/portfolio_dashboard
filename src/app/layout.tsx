import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Live Portfolio Dashboard", description: "Real-time portfolio tracker for NSE/BSE holdings" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
