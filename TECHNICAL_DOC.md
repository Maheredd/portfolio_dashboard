# Technical write-up: challenges and solutions

**1. No official Yahoo/Google APIs.** Yahoo's quote endpoint now needs a crumb/cookie, but the public v8 chart endpoint returns `regularMarketPrice` without one, so it is used for CMP with a query1→query2 fallback. Google Finance has no API, so P/E and EPS are parsed from the quote page HTML. Both run only on the server.

**2. Fragility and rate limits.** A cache layer (10 s prices, 10 min fundamentals), in-flight request sharing, a small concurrency pool and timeouts keep upstream traffic low even with many open tabs. P/E and earnings change slowly, so they have their own slower endpoint and never delay the 15 s price loop.

**3. Failures must not blank the screen.** Each value carries a source: live, stale (last good) or snapshot (Excel). The UI shows a status dot per value, a summary banner listing failed symbols, and a retry button when the whole request fails.

**4. Mixed symbol formats.** The sheet mixes NSE tickers and numeric BSE codes. A generator script maps them to Yahoo (`.NS`/`.BO`) and Google (`:NSE`/`:BOM`) formats once, into `portfolio.json`.

**5. Real-time without wasted renders.** Countdown has its own timer component so the tables are not re-rendered every tick. Sector sections and flash cells are `React.memo`; totals, grouping and filtering use `useMemo`. Changed prices flash for 1.2 s and respect `prefers-reduced-motion`.

**6. Data transformation.** `buildRows` derives Investment, Portfolio %, Present Value and Gain/Loss from holdings + quotes in one pure function; `groupBySector` computes sector summaries. Sheet errors (#N/A) become `null` and render as "—".

**7. Possible next steps.** WebSocket/SSE push, Redis cache for multi-instance deploys, a paid market-data provider for production accuracy, and tests around the Google parsers.
