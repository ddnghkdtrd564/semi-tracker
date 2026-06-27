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

async function buildPie() {
  const tickers = ukDividendPie.map((h) => h.t);

  // 1. Try Finnhub for every ticker (works for US always, often works for .L too at 15-min delay)
  const finnhubResults = await Promise.all(
    tickers.map(async (t) => {
      try { return { t, q: await fetchFinnhubQuote(t) }; }
      catch (e) { return { t, q: null }; }
    })
  );
  const finnhubMap = {};
  finnhubResults.forEach(({ t, q }) => { finnhubMap[t] = q; });

  // 2. Whichever tickers came back empty/zero from Finnhub, batch-fallback to Yahoo
  const weakTickers = tickers.filter((t) => {
    const q = finnhubMap[t];
    return !q || typeof q.c !== 'number' || q.c === 0;
  });
  let yahooMap = {};
  if (weakTickers.length > 0) {
    try { yahooMap = await fetchYahooBatch(weakTickers); }
    catch (e) { /* leave yahooMap empty; handled per-row below */ }
  }
  // 3. Also pull Yahoo for ALL tickers to source stats (mkt cap / P/E / 52wk) — broader coverage than Finnhub free tier for LSE
  let yahooStatsMap = {};
  try { yahooStatsMap = await fetchYahooBatch(tickers); } catch (e) { /* fall through, stats will show informative message */ }

  // 4. Live analyst target + EPS surprise for the two US-listed names
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
    const fq = finnhubMap[h.t];
    const yq = yahooMap[h.t];
    const ys = yahooStatsMap[h.t];

    let price = null, move = null, priceSource = null;
    if (fq && typeof fq.c === 'number' && fq.c !== 0) {
      price = fq.c; move = typeof fq.dp === 'number' ? fq.dp : null; priceSource = 'finnhub';
    } else if (yq && typeof yq.regularMarketPrice === 'number') {
      price = yq.regularMarketPrice; move = typeof yq.regularMarketChangePercent === 'number' ? yq.regularMarketChangePercent : null; priceSource = 'yahoo';
    }

    const stats = ys ? {
      marketCap: ys.marketCap ?? null,
      peRatio: ys.trailingPE ?? null,
      fiftyTwoWeekLow: ys.fiftyTwoWeekLow ?? null,
      fiftyTwoWeekHigh: ys.fiftyTwoWeekHigh ?? null,
      volume: ys.regularMarketVolume ?? null,
      currency: ys.currency ?? null,
    } : null;

    const extra = liveExtras[h.t];

    return {
      ...h,
      price, move, priceSource,
      stats,
      liveAnalyst: extra?.priceTarget || null,
      liveEarnings: extra?.earnings || null,
    };
  });

  return { holdings, fetchedAt: new Date().toISOString() };
}

app.get('/api/pie', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY is not set. Add it under Render > Environment.' });
    if (pieCache.data && Date.now() - pieCache.ts < CACHE_MS) return res.json(pieCache.data);
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
