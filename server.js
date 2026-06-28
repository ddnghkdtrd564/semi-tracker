const express = require('express');
const path = require('path');
const { ukDividendPie } = require('./data/ukDividendPie');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FINNHUB_API_KEY; // set in Render > Environment, never in code

// ============================================================
// FUND REGISTRY (SEMI / IUSA trackers — unchanged from before)
// ============================================================
const funds = {
  SEMI: {
    name: 'iShares MSCI Global Semiconductors UCITS ETF',
    ticker: 'SEMI', exchange: 'LSE',
    description: 'Tracks the MSCI ACWI IMI Semiconductors & Semiconductor Equipment ESG Screened index — global exposure to chip designers, manufacturers and equipment makers (~352 holdings).',
    holdings: [
      { t: 'AVGO', n: 'Broadcom', w: 7.97 }, { t: 'MU', n: 'Micron Technology', w: 7.42 },
      { t: 'NVDA', n: 'Nvidia', w: 7.11 }, { t: 'TSM', n: 'Taiwan Semiconductor (ADR)', w: 6.90 },
      { t: 'ASML', n: 'ASML Holding (ADR)', w: 6.76 }, { t: 'AMD', n: 'Advanced Micro Devices', w: 5.36 },
      { t: 'INTC', n: 'Intel', w: 4.64 }, { t: 'LRCX', n: 'Lam Research', w: 4.43 },
      { t: 'AMAT', n: 'Applied Materials', w: 4.32 }, { t: 'KLAC', n: 'KLA Corp', w: 3.53 },
      { t: 'TXN', n: 'Texas Instruments', w: 3.13 }, { t: 'ADI', n: 'Analog Devices', w: 2.73 },
      { t: 'QCOM', n: 'Qualcomm', w: 2.17 }, { t: 'MRVL', n: 'Marvell Technology', w: 1.77 },
      { t: 'MPWR', n: 'Monolithic Power Systems', w: 1.05 }, { t: 'TER', n: 'Teradyne', w: 0.89 },
      { t: 'NXPI', n: 'NXP Semiconductors', w: 0.81 },
    ],
    untracked: [
      { t: '000660.KS', n: 'SK Hynix', w: 4.87 }, { t: '6857.T', n: 'Advantest', w: 2.02 },
      { t: '8035.T', n: 'Tokyo Electron', w: 1.87 }, { t: '2454.TW', n: 'MediaTek', w: 1.38 },
      { t: 'IFX.DE', n: 'Infineon Technologies', w: 1.13 }, { t: '2311.TW', n: 'ASE Technology', w: 0.70 },
    ],
    otherWeight: 15.35, otherCount: 327,
  },
  IUSA: {
    name: 'iShares Core S&P 500 UCITS ETF (Dist)',
    ticker: 'IUSA', exchange: 'LSE',
    description: 'Tracks the S&P 500 — the 500 largest publicly traded US companies by market cap, weighted by size. Quarterly cash distribution (~0.65–1.0% yield).',
    holdings: [
      { t: 'NVDA', n: 'Nvidia', w: 7.80 }, { t: 'AAPL', n: 'Apple', w: 6.70 }, { t: 'MSFT', n: 'Microsoft', w: 4.20 },
      { t: 'AMZN', n: 'Amazon', w: 3.54 }, { t: 'GOOGL', n: 'Alphabet (Class A)', w: 1.90 }, { t: 'GOOG', n: 'Alphabet (Class C)', w: 1.60 },
      { t: 'META', n: 'Meta Platforms', w: 2.50 }, { t: 'AVGO', n: 'Broadcom', w: 2.30 }, { t: 'BRK.B', n: 'Berkshire Hathaway', w: 1.60 },
      { t: 'TSLA', n: 'Tesla', w: 1.50 }, { t: 'JPM', n: 'JPMorgan Chase', w: 1.40 },
    ],
    untracked: [], otherWeight: 64.96, otherCount: 493,
  },
};

const CACHE_MS = 60 * 1000;
const caches = {};

async function fetchFinnhubQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub HTTP ${r.status}`);
  return r.json();
}

async function buildSnapshot(fund) {
  const results = await Promise.all(
    fund.holdings.map(async (h) => {
      try {
        const q = await fetchFinnhubQuote(h.t);
        const move = typeof q.dp === 'number' ? q.dp : null;
        const price = typeof q.c === 'number' && q.c !== 0 ? q.c : null;
        return { ...h, move, price };
      } catch (e) {
        return { ...h, move: null, price: null, error: e.message };
      }
    })
  );
  return {
    name: fund.name, ticker: fund.ticker, exchange: fund.exchange, description: fund.description,
    holdings: results, untracked: fund.untracked, otherWeight: fund.otherWeight, otherCount: fund.otherCount,
    fetchedAt: new Date().toISOString(),
  };
}

app.get('/api/snapshot/:fund', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY is not set. Add it under Render > Environment.' });
    const key = req.params.fund.toUpperCase();
    const fund = funds[key];
    if (!fund) return res.status(404).json({ error: `Unknown fund "${key}"` });
    const cache = caches[key];
    if (cache && Date.now() - cache.ts < CACHE_MS) return res.json(cache.data);
    const data = await buildSnapshot(fund);
    caches[key] = { data, ts: Date.now() };
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// UK DIVIDEND PIE 🥧
// Live price + stats: Finnhub primary, Yahoo Finance fallback.
// Dividend dates/yields/analyst/EPS for LSE names: curated dataset
// (see data/ukDividendPie.js) — free APIs don't cover this reliably.
// US names (INTC, KLAC) get LIVE analyst target + EPS surprise too.
// ============================================================

// Yahoo's v7/finance/quote BATCH endpoint increasingly requires an auth "crumb"
// and often 401s when called without a browser session — this was the likely
// reason LSE prices were coming back empty. The v8/finance/chart endpoint
// (the same one the Python "yfinance" library uses under the hood) has a much
// better track record working unauthenticated. We call it once per symbol —
// still cheap, just parallel HTTP calls — and treat v7 as a bonus-only,
// best-effort source for extra stats (market cap / P/E) that never blocks
// the critical price data if it fails.
async function fetchYahooChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  const body = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
  const json = JSON.parse(body);
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('no price in response');
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  const move = (typeof prevClose === 'number' && prevClose !== 0) ? ((price - prevClose) / prevClose) * 100 : null;
  return {
    price, move, currency: meta.currency || null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null, fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    volume: meta.regularMarketVolume ?? null,
  };
}

async function fetchYahooChartBatch(symbols, diag) {
  const map = {};
  await Promise.all(symbols.map(async (s) => {
    try { map[s] = await fetchYahooChart(s); }
    catch (e) { diag.push({ ticker: s, source: 'yahoo-chart', error: e.message }); }
  }));
  return map;
}

// Best-effort only — bonus market cap / P/E. Failing here never blocks price data.
async function fetchYahooQuoteStatsBatch(symbols, diag) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
    const json = JSON.parse(body);
    const map = {};
    (json?.quoteResponse?.result || []).forEach((q) => { map[q.symbol] = q; });
    return map;
  } catch (e) {
    diag.push({ ticker: 'ALL', source: 'yahoo-quote-stats(bonus)', error: e.message });
    return {};
  }
}

// Stooq — free, no API key, explicitly covers LSE ("xxxx.uk" tickers).
async function fetchStooqBatch(stooqSymbols, diag) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbols.join(','))}&f=sd2t2ohlcv&h&e=csv`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status}: ${text.slice(0, 120)}`);
  const lines = text.trim().split('\n');
  const map = {};
  lines.slice(1).forEach((line) => {
    const cols = line.split(',');
    const sym = (cols[0] || '').toLowerCase();
    const close = parseFloat(cols[6]);
    if (sym && !isNaN(close) && close > 0) map[sym] = { close };
    else diag.push({ ticker: sym || '(unknown)', source: 'stooq', error: `unparseable row: ${line}` });
  });
  return map;
}

// Turn our internal LSE ticker ("LLOY.L") into Stooq's convention ("lloy.uk")
function toStooqSymbol(ticker) {
  return ticker.replace(/\.L$/i, '').toLowerCase() + '.uk';
}

// Server-side memory of the last successful price per ticker, so a fully-failed
// refresh cycle never blanks a row — it shows the last good price, marked stale.
const lastGoodPrice = {};

async function fetchFinnhubMetric(symbol) {
  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub metric HTTP ${r.status}`);
  return r.json();
}

async function fetchFinnhubPriceTarget(symbol) {
  const url = `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub target HTTP ${r.status}`);
  return r.json();
}

async function fetchFinnhubEarnings(symbol) {
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub earnings HTTP ${r.status}`);
  return r.json();
}

let pieCache = { data: null, ts: 0 };
const PIE_CACHE_MS = 30 * 1000;

async function buildPie() {
  const diag = []; // collects every failed attempt with a reason — never silently swallowed
  const lseTickers = ukDividendPie.filter((h) => h.exch === 'LSE').map((h) => h.t);
  const usTickers = ukDividendPie.filter((h) => h.exch === 'US').map((h) => h.t);

  // ---- LSE chain: Yahoo chart (primary, per-symbol, no-auth-friendly) -> Stooq -> Finnhub (tertiary) ----
  const yahooLse = await fetchYahooChartBatch(lseTickers, diag);

  const stillNeedLse = lseTickers.filter((t) => !yahooLse[t]);
  let stooqMap = {};
  if (stillNeedLse.length > 0) {
    try { stooqMap = await fetchStooqBatch(stillNeedLse.map(toStooqSymbol), diag); }
    catch (e) { diag.push({ ticker: 'ALL-LSE', source: 'stooq', error: e.message }); }
  }

  const stillNeedLse2 = stillNeedLse.filter((t) => !stooqMap[toStooqSymbol(t)]);
  const finnhubLse = {};
  if (stillNeedLse2.length > 0) {
    await Promise.all(stillNeedLse2.map(async (t) => {
      try {
        const q = await fetchFinnhubQuote(t);
        if (typeof q.c === 'number' && q.c !== 0) finnhubLse[t] = q;
        else diag.push({ ticker: t, source: 'finnhub', error: `empty quote (c=${q.c})` });
      } catch (e) { diag.push({ ticker: t, source: 'finnhub', error: e.message }); }
    }));
  }

  // ---- US chain: Finnhub (primary) -> Yahoo chart (fallback) ----
  const finnhubUs = {};
  await Promise.all(usTickers.map(async (t) => {
    try {
      const q = await fetchFinnhubQuote(t);
      if (typeof q.c === 'number' && q.c !== 0) finnhubUs[t] = q;
      else diag.push({ ticker: t, source: 'finnhub', error: `empty quote (c=${q.c})` });
    } catch (e) { diag.push({ ticker: t, source: 'finnhub', error: e.message }); }
  }));
  const weakUs = usTickers.filter((t) => !finnhubUs[t]);
  const yahooUs = weakUs.length > 0 ? await fetchYahooChartBatch(weakUs, diag) : {};

  // ---- Bonus stats only (market cap / P/E) — best-effort, never blocks price data ----
  const yahooStatsMap = await fetchYahooQuoteStatsBatch(ukDividendPie.map((h) => h.t), diag);

  // ---- Live analyst target + EPS surprise for the two US-listed names ----
  const liveExtras = {};
  for (const h of ukDividendPie) {
    if (h.exch === 'US') {
      try {
        const [pt, earn] = await Promise.all([fetchFinnhubPriceTarget(h.t), fetchFinnhubEarnings(h.t)]);
        liveExtras[h.t] = { priceTarget: pt, earnings: (earn || []).slice(0, 4) };
      } catch (e) {
        liveExtras[h.t] = { priceTarget: null, earnings: null };
        diag.push({ ticker: h.t, source: 'finnhub-analyst/eps', error: e.message });
      }
    }
  }

  const holdings = ukDividendPie.map((h) => {
    let price = null, move = null, priceSource = null, stale = false, liveCurrency = null, fiftyTwoWeekLow = null, fiftyTwoWeekHigh = null, volume = null;

    if (h.exch === 'LSE') {
      const yc = yahooLse[h.t];
      const sq = stooqMap[toStooqSymbol(h.t)];
      const fq = finnhubLse[h.t];
      if (yc) {
        price = yc.price; move = yc.move; priceSource = 'yahoo';
        liveCurrency = yc.currency; fiftyTwoWeekLow = yc.fiftyTwoWeekLow; fiftyTwoWeekHigh = yc.fiftyTwoWeekHigh; volume = yc.volume;
      } else if (sq) {
        price = sq.close; move = null; priceSource = 'stooq';
      } else if (fq) {
        price = fq.c; move = typeof fq.dp === 'number' ? fq.dp : null; priceSource = 'finnhub';
      }
    } else {
      const fq = finnhubUs[h.t];
      const yc = yahooUs[h.t];
      if (fq) {
        price = fq.c; move = typeof fq.dp === 'number' ? fq.dp : null; priceSource = 'finnhub';
      } else if (yc) {
        price = yc.price; move = yc.move; priceSource = 'yahoo';
        liveCurrency = yc.currency; fiftyTwoWeekLow = yc.fiftyTwoWeekLow; fiftyTwoWeekHigh = yc.fiftyTwoWeekHigh; volume = yc.volume;
      }
    }

    // Last line of defence: every live source failed this cycle — use last known good price rather than blank.
    if (price === null && lastGoodPrice[h.t]) {
      price = lastGoodPrice[h.t].price; move = lastGoodPrice[h.t].move; priceSource = lastGoodPrice[h.t].source;
      stale = true;
    } else if (price !== null) {
      lastGoodPrice[h.t] = { price, move, source: priceSource, ts: Date.now() };
    }

    const ys = yahooStatsMap[h.t];
    // Currency: prefer whatever a live source actually reported this cycle; otherwise
    // fall back to the curated default (data file) — so the unit is NEVER unknown,
    // even on a cycle where every live source failed.
    const currency = liveCurrency || ys?.currency || h.defaultCurrency || null;

    const stats = {
      marketCap: ys?.marketCap ?? null,
      peRatio: ys?.trailingPE ?? null,
      fiftyTwoWeekLow: fiftyTwoWeekLow ?? ys?.fiftyTwoWeekLow ?? null,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh ?? ys?.fiftyTwoWeekHigh ?? null,
      volume: volume ?? ys?.regularMarketVolume ?? null,
      currency,
    };

    const extra = liveExtras[h.t];
    return {
      ...h, price, move, priceSource, stale,
      staleAgeSec: stale && lastGoodPrice[h.t] ? Math.round((Date.now() - lastGoodPrice[h.t].ts) / 1000) : null,
      stats, liveAnalyst: extra?.priceTarget || null, liveEarnings: extra?.earnings || null,
    };
  });

  // Always log a summary server-side (visible in Render's Logs tab) so failures
  // are diagnosable without needing to add anything extra.
  const blanks = holdings.filter((h) => h.price === null).map((h) => h.t);
  console.log(`[pie] refresh: ${holdings.length - blanks.length}/${holdings.length} priced. Sources: yahoo=${Object.keys(yahooLse).length+Object.keys(yahooUs).length}, stooq=${Object.keys(stooqMap).length}, finnhub=${Object.keys(finnhubLse).length+Object.keys(finnhubUs).length}.${blanks.length ? ' STILL BLANK: ' + blanks.join(',') : ''}`);
  if (diag.length) console.log('[pie] diagnostics:', JSON.stringify(diag));

  return { holdings, fetchedAt: new Date().toISOString(), diag };
}

app.get('/api/pie', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY is not set. Add it under Render > Environment.' });
    if (pieCache.data && Date.now() - pieCache.ts < PIE_CACHE_MS) {
      const out = req.query.debug ? pieCache.data : { holdings: pieCache.data.holdings, fetchedAt: pieCache.data.fetchedAt };
      return res.json(out);
    }
    const data = await buildPie();
    pieCache = { data, ts: Date.now() };
    const out = req.query.debug ? data : { holdings: data.holdings, fetchedAt: data.fetchedAt };
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- News (lazy-loaded per holding, cached 10 min) ----
const newsCache = {};
app.get('/api/news/:ticker', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY is not set.' });
    const ticker = req.params.ticker;
    const cached = newsCache[ticker];
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return res.json(cached.data);

    const to = new Date();
    const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Finnhub news HTTP ${r.status}`);
    const items = (await r.json()).slice(0, 5).map((n) => ({
      headline: n.headline, source: n.source, url: n.url, datetime: n.datetime * 1000,
    }));
    const data = { items };
    newsCache[ticker] = { data, ts: Date.now() };
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// LANDING PAGE — "most popular markets" board
// ============================================================
const popularMarkets = [
  { t: '^GSPC', label: 'S&P 500', n: 'US large-cap benchmark' },
  { t: '^IXIC', label: 'Nasdaq', n: 'US tech-heavy index' },
  { t: '^DJI', label: 'Dow Jones', n: '30 major US companies' },
  { t: '^FTSE', label: 'FTSE 100', n: 'UK large-cap benchmark' },
  { t: '^N225', label: 'Nikkei 225', n: 'Japan benchmark' },
  { t: '^GDAXI', label: 'DAX', n: 'Germany benchmark' },
];
let indicesCache = { data: null, ts: 0 };
const INDICES_CACHE_MS = 45 * 1000;

app.get('/api/indices', async (req, res) => {
  if (indicesCache.data && Date.now() - indicesCache.ts < INDICES_CACHE_MS) return res.json(indicesCache.data);
  const diag = [];
  const map = await fetchYahooChartBatch(popularMarkets.map((m) => m.t), diag);
  const markets = popularMarkets.map((m) => ({
    ...m,
    price: map[m.t]?.price ?? null,
    move: map[m.t]?.move ?? null,
    currency: map[m.t]?.currency ?? null,
  }));
  const data = { markets, fetchedAt: new Date().toISOString() };
  indicesCache = { data, ts: Date.now() };
  if (diag.length) console.log('[indices] diagnostics:', JSON.stringify(diag));
  res.json(data);
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Tracker listening on port ${PORT}`));
