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

async function fetchYahooBatch(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioTracker/1.0)' } });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const json = await r.json();
  const map = {};
  (json?.quoteResponse?.result || []).forEach((q) => { map[q.symbol] = q; });
  return map;
}

// Stooq — free, no API key, explicitly covers LSE ("xxxx.uk" tickers). Used as a
// third-layer fallback for price only (it doesn't reliably give a clean % move
// in this lightweight CSV format, so we leave move=null when this is the source
// rather than guess). NOTE: unverified against a live call from this build
// environment (no outbound network here) — first thing to check if LSE prices
// ever come back empty after deploy.
async function fetchStooqBatch(stooqSymbols) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbols.join(','))}&f=sd2t2ohlcv&h&e=csv`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioTracker/1.0)' } });
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split('\n');
  const map = {};
  lines.slice(1).forEach((line) => {
    const cols = line.split(',');
    const sym = (cols[0] || '').toLowerCase();
    const close = parseFloat(cols[6]);
    if (sym && !isNaN(close) && close > 0) map[sym] = { close };
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
const PIE_CACHE_MS = 30 * 1000; // refreshed faster than fund tabs — Yahoo/Stooq batch calls are cheap (1 HTTP call covers all 26 tickers)

async function buildPie() {
  const lseTickers = ukDividendPie.filter((h) => h.exch === 'LSE').map((h) => h.t);
  const usTickers = ukDividendPie.filter((h) => h.exch === 'US').map((h) => h.t);

  // ---- LSE chain: Yahoo (primary) -> Stooq (free, no-key, explicit LSE coverage) -> Finnhub (tertiary) ----
  let yahooLse = {};
  try { yahooLse = await fetchYahooBatch(lseTickers); } catch (e) { /* fall through to Stooq/Finnhub */ }

  const stillNeedLse = lseTickers.filter((t) => !(yahooLse[t] && typeof yahooLse[t].regularMarketPrice === 'number'));
  let stooqMap = {};
  if (stillNeedLse.length > 0) {
    try {
      const stooqSymbols = stillNeedLse.map(toStooqSymbol);
      stooqMap = await fetchStooqBatch(stooqSymbols);
    } catch (e) { /* fall through to Finnhub */ }
  }

  const stillNeedLse2 = stillNeedLse.filter((t) => !stooqMap[toStooqSymbol(t)]);
  let finnhubLse = {};
  if (stillNeedLse2.length > 0) {
    const results = await Promise.all(stillNeedLse2.map(async (t) => {
      try { return { t, q: await fetchFinnhubQuote(t) }; } catch (e) { return { t, q: null }; }
    }));
    results.forEach(({ t, q }) => { finnhubLse[t] = q; });
  }

  // ---- US chain: Finnhub (primary, well-documented free coverage) -> Yahoo (fallback) ----
  const finnhubUsResults = await Promise.all(usTickers.map(async (t) => {
    try { return { t, q: await fetchFinnhubQuote(t) }; } catch (e) { return { t, q: null }; }
  }));
  const finnhubUs = {};
  finnhubUsResults.forEach(({ t, q }) => { finnhubUs[t] = q; });
  const weakUs = usTickers.filter((t) => !(finnhubUs[t] && typeof finnhubUs[t].c === 'number' && finnhubUs[t].c !== 0));
  let yahooUs = {};
  if (weakUs.length > 0) { try { yahooUs = await fetchYahooBatch(weakUs); } catch (e) { /* none left */ } }

  // ---- Stats (market cap / P/E / 52wk / volume): Yahoo for everyone, broadest free coverage ----
  let yahooStatsMap = {};
  try { yahooStatsMap = await fetchYahooBatch(ukDividendPie.map((h) => h.t)); } catch (e) { /* informative message shown per-row */ }

  // ---- Live analyst target + EPS surprise for the two US-listed names ----
  const liveExtras = {};
  for (const h of ukDividendPie) {
    if (h.exch === 'US') {
      try {
        const [pt, earn] = await Promise.all([fetchFinnhubPriceTarget(h.t), fetchFinnhubEarnings(h.t)]);
        liveExtras[h.t] = { priceTarget: pt, earnings: (earn || []).slice(0, 4) };
      } catch (e) {
        liveExtras[h.t] = { priceTarget: null, earnings: null, error: e.message };
      }
    }
  }

  const holdings = ukDividendPie.map((h) => {
    let price = null, move = null, priceSource = null, stale = false;

    if (h.exch === 'LSE') {
      const yq = yahooLse[h.t];
      const sq = stooqMap[toStooqSymbol(h.t)];
      const fq = finnhubLse[h.t];
      if (yq && typeof yq.regularMarketPrice === 'number') {
        price = yq.regularMarketPrice; move = typeof yq.regularMarketChangePercent === 'number' ? yq.regularMarketChangePercent : null; priceSource = 'yahoo';
      } else if (sq) {
        price = sq.close; move = null; priceSource = 'stooq';
      } else if (fq && typeof fq.c === 'number' && fq.c !== 0) {
        price = fq.c; move = typeof fq.dp === 'number' ? fq.dp : null; priceSource = 'finnhub';
      }
    } else {
      const fq = finnhubUs[h.t];
      const yq = yahooUs[h.t];
      if (fq && typeof fq.c === 'number' && fq.c !== 0) {
        price = fq.c; move = typeof fq.dp === 'number' ? fq.dp : null; priceSource = 'finnhub';
      } else if (yq && typeof yq.regularMarketPrice === 'number') {
        price = yq.regularMarketPrice; move = typeof yq.regularMarketChangePercent === 'number' ? yq.regularMarketChangePercent : null; priceSource = 'yahoo';
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
    const stats = ys ? {
      marketCap: ys.marketCap ?? null, peRatio: ys.trailingPE ?? null,
      fiftyTwoWeekLow: ys.fiftyTwoWeekLow ?? null, fiftyTwoWeekHigh: ys.fiftyTwoWeekHigh ?? null,
      volume: ys.regularMarketVolume ?? null, currency: ys.currency ?? null,
    } : null;

    const extra = liveExtras[h.t];
    return {
      ...h, price, move, priceSource, stale,
      staleAgeSec: stale && lastGoodPrice[h.t] ? Math.round((Date.now() - lastGoodPrice[h.t].ts) / 1000) : null,
      stats, liveAnalyst: extra?.priceTarget || null, liveEarnings: extra?.earnings || null,
    };
  });

  return { holdings, fetchedAt: new Date().toISOString() };
}

app.get('/api/pie', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY is not set. Add it under Render > Environment.' });
    if (pieCache.data && Date.now() - pieCache.ts < PIE_CACHE_MS) return res.json(pieCache.data);
    const data = await buildPie();
    pieCache = { data, ts: Date.now() };
    res.json(data);
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

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Tracker listening on port ${PORT}`));
