# Portfolio Dashboard

A live dashboard for tracking an Indian equity portfolio across NSE and BSE. It combines market prices and company fundamentals with a local holdings snapshot, then calculates portfolio value, returns, and sector allocation in one place.

**Live Demo:** [portfolio-dashboard-blue-one.vercel.app](https://portfolio-dashboard-blue-one.vercel.app/)

<p>
    <a href="https://portfolio-dashboard-blue-one.vercel.app/"><img alt="Live demo" src="https://img.shields.io/badge/demo-live-0070f3?style=flat-square&logo=vercel&logoColor=white"></a>
    <a href="https://github.com/Maheredd/portfolio_dashboard/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Maheredd/portfolio_dashboard?style=flat-square&label=stars"></a>
    <a href="https://github.com/Maheredd/portfolio_dashboard/network/members"><img alt="GitHub forks" src="https://img.shields.io/github/forks/Maheredd/portfolio_dashboard?style=flat-square&label=forks"></a>
    <a href="https://github.com/Maheredd/portfolio_dashboard/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/Maheredd/portfolio_dashboard?style=flat-square"></a>
    <a href="https://github.com/Maheredd/portfolio_dashboard"><img alt="Languages" src="https://img.shields.io/github/languages/count/Maheredd/portfolio_dashboard?style=flat-square"></a>
</p>

## Highlights

- Tracks live CMP, present value, and gain/loss for NSE and BSE holdings, with automatic 15-second refresh and manual pause or refresh controls.
- Shows portfolio totals, strongest and weakest performers, sector allocation, and sector-level returns.
- Search holdings, filter by profit or loss, sort columns, and expand or collapse sectors.
- Labels live, stale, and snapshot values separately; uses the last good quote or local snapshot when a source is unavailable.
- Displays P/E and latest EPS where available, plus market open/closed status.

## Built With

Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Recharts, and TanStack Table.

## Run Locally

Requirements: Node.js 18.17 or later and internet access for market data. No API keys are required.

```bash
git clone https://github.com/Maheredd/portfolio_dashboard.git
cd portfolio_dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build, run `npm run build` followed by `npm start`.

## Data and Architecture

```text
Browser ── every 15 seconds ──> /api/prices ──> Yahoo Finance chart data (CMP)
Browser ── every 10 minutes ──> /api/fundamentals ──> Google Finance page (P/E, EPS)
```

Both upstream requests run on the server. Holdings and fallback snapshot values are in [`src/data/portfolio.json`](src/data/portfolio.json). Update that file to change the portfolio. Alphabetic ticker symbols are mapped to NSE formats; numeric codes use BSE formats.

The server caches prices for 10 seconds and fundamentals for 10 minutes, shares concurrent requests for the same symbol, limits upstream concurrency, and applies request timeouts. The cache is in memory per server process.

## Data Limitations

Yahoo Finance and Google Finance are accessed through unofficial endpoints; values may be delayed, unavailable, or different from a broker. Google page markup can change. When live data cannot be retrieved, the dashboard falls back to the last good value or the local snapshot. The in-memory cache is not shared between multiple server instances. This project is for portfolio tracking and is not investment advice.

For implementation details and tradeoffs, see [`TECHNICAL_DOC.md`](TECHNICAL_DOC.md).
