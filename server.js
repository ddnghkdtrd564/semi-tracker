const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FINNHUB_API_KEY; // set this in Render's Environment tab, never in code

// --- SEMI (iShares MSCI Global Semiconductors UCITS ETF) holdings ---
// Weights are from the most recently available factsheet snapshot.
// Upload the full BlackRock holdings export to Claude any time to refresh/expand this list.
const holdings = [
  { t: 'AVGO',  n: 'Broadcom',                     w: 7.97 },
  { t: 'MU',    n: 'Micron Technology',             w: 7.42 },
  { t: 'NVDA',  n: 'Nvidia',                        w: 7.11 },
  { t: 'TSM',   n: 'Taiwan Semiconductor (ADR)',    w: 6.90 },
  { t: 'ASML',  n: 'ASML Holding (ADR)',            w: 6.76 },
  { t: 'AMD',   n: 'Advanced Micro Devices',        w: 5.36 },
  { t: 'INTC',  n: 'Intel',                         w: 4.64 },
  { t: 'LRCX',  n: 'Lam Research',                  w: 4.43 },
  { t: 'AMAT',  n: 'Applied Materials',             w: 4.32 },
  { t: 'KLAC',  n: 'KLA Corp',                      w: 3.53 },
  { t: 'TXN',   n: 'Texas Instruments',             w: 3.13 },
  { t: 'ADI',   n: 'Analog Devices',                w: 2.73 },
  { t: 'QCOM',  n: 'Qualcomm',                      w: 2.17 },
  { t: 'MRVL',  n: 'Marvell Technology',            w: 1.77 },
  { t: 'MPWR',  n: 'Monolithic Power Systems',      w: 1.05 },
  { t: 'TER',   n: 'Teradyne',                      w: 0.89 },
  { t: 'NXPI',  n: 'NXP Semiconductors',            w: 0.81 },
];

// Listed on exchanges Finnhub's free tier doesn't cover live — shown for transparency, not priced.
const untracked = [
  { t: '000660.KS', n: 'SK Hynix',              w: 4.87 },
  { t: '6857.T',     n: 'Advantest',             w: 2.02 },
  { t: '8035.T',     n: 'Tokyo Electron',        w: 1.87 },
  { t: '2454.TW',    n: 'MediaTek',              w: 1.38 },
  { t: 'IFX.DE',     n: 'Infineon Technologies', w: 1.13 },
  { t: '2311.TW',    n: 'ASE Technology',        w: 0.70 },
];

const OTHER_WEIGHT = 15.35; // long tail of smaller holdings, not individually tracked
const OTHER_COUNT = 327;

const CACHE_MS = 60 * 1000; // refresh at most once a minute — keeps us well under Finnhub's 60 calls/min cap
let cache = { data: null, ts: 0 };

async function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub HTTP ${r.status} for ${symbol}`);
  return r.json();
}

async function buildSnapshot() {
  const results = await Promise.all(
    holdings.map(async (h) => {
      try {
        const q = await fetchQuote(h.t);
        const move = typeof q.dp === 'number' ? q.dp : null; // dp = percent change
        const price = typeof q.c === 'number' ? q.c : null;
        return { ...h, move, price };
      } catch (e) {
        return { ...h, move: null, price: null, error: e.message };
      }
    })
  );
  return {
    holdings: results,
    untracked,
    otherWeight: OTHER_WEIGHT,
    otherCount: OTHER_COUNT,
    fetchedAt: new Date().toISOString(),
  };
}

app.get('/api/snapshot', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'FINNHUB_API_KEY is not set. Add it under Render > Environment.' });
    }
    if (cache.data && Date.now() - cache.ts < CACHE_MS) {
      return res.json(cache.data);
    }
    const data = await buildSnapshot();
    cache = { data, ts: Date.now() };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`SEMI tracker listening on port ${PORT}`));
