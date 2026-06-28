// ============================================================
// UK DIVIDEND PIE 🥧 — reference dataset
// Weights = the pie's TARGET allocation (not current £ holdings).
// yieldPct / frequency / payments = curated from company & fund
// announcements (not a live feed — free APIs don't reliably cover
// this for LSE-listed names). analyst/eps = curated research notes,
// dated, for the same reason. Re-ask Claude periodically to refresh.
// asOf: 2026-06-27
// ============================================================

const ukDividendPie = [
  {
    t: 'RR.L', label: 'RR', n: 'Rolls-Royce', w: 11, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 0.8, frequency: 'Semi-annual (resumed 2024)',
    payments: [{ label: 'Typical', months: 'Mar & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 3, highPct: 5, note: 'Consensus "Strong Buy" but much of the turnaround is already priced in after a multi-year rally.', asOf: '2026-06-25' },
    eps: { note: 'EPS growing strongly post-turnaround (~15%+/yr in recent guidance), but no live actual-vs-estimate feed available free for LSE.' },
  },
  {
    t: 'IUSA.L', label: 'IUSA', n: 'iShares Core S&P 500 (Dist)', w: 9, exch: 'LSE', isIndexFund: true, defaultCurrency: 'GBP',
    yieldPct: 0.95, frequency: 'Quarterly',
    payments: [
      { label: 'Q2', exDiv: '2026-06-12', pay: '2026-06-30', splitPct: 25, estimated: false },
      { label: 'Q3', exDiv: '2026-09-11', pay: '2026-09-30', splitPct: 25, estimated: true },
      { label: 'Q4', exDiv: '2026-12-11', pay: '2027-01-08', splitPct: 25, estimated: true },
      { label: 'Q1', exDiv: '2027-03-18', pay: '2027-03-31', splitPct: 25, estimated: true },
    ],
    analyst: null, eps: null,
  },
  {
    t: 'LLOY.L', label: 'LLOY', n: 'Lloyds Banking Group', w: 9, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 3.8, frequency: 'Semi-annual',
    payments: [
      { label: 'Interim', exDiv: '2026-07-31', pay: '2026-09-09', splitPct: 33.4, estimated: false },
      { label: 'Final', exDiv: '2027-04-08', pay: '2027-05-18', splitPct: 66.6, estimated: true },
    ],
    analyst: { lowPct: 12, highPct: 16, note: 'UK banks broadly favoured by strategists for 2026; one of the stronger consensus upside cases in this pie.', asOf: '2026-06-25' },
    eps: { note: 'Forward P/E (~9.7x) sits below trailing (~10.9x), implying analysts expect further earnings growth into 2026.' },
  },
  {
    t: 'CNKY.L', label: 'CNKY', n: 'iShares Nikkei 225 (Acc)', w: 7, exch: 'LSE', isIndexFund: true, defaultCurrency: 'GBP',
    yieldPct: 0, frequency: 'Accumulating — no cash dividend',
    payments: [], analyst: null, eps: null,
  },
  {
    t: 'LGEN.L', label: 'LGEN', n: 'Legal & General', w: 7, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 7.8, frequency: 'Semi-annual',
    payments: [
      { label: 'Interim', exDiv: '2026-08-20', pay: '2026-09-25', splitPct: 28.1, estimated: false },
      { label: 'Final', exDiv: '2027-04-22', pay: '2027-06-03', splitPct: 71.9, estimated: true },
    ],
    analyst: { lowPct: 5, highPct: 10, note: 'Forward P/E implies a large expected earnings recovery — insurer accounting is lumpy, so this carries above-average uncertainty.', asOf: '2026-06-25' },
    eps: { note: 'Trailing P/E ~35x vs forward ~11x — a big implied earnings step-up that has not yet shown up in reported numbers.' },
  },
  {
    t: 'VWRL.L', label: 'VWRL', n: 'Vanguard FTSE All-World (Dist)', w: 6, exch: 'LSE', isIndexFund: true, defaultCurrency: 'GBP',
    yieldPct: 1.8, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Mar, Jun, Sep, Dec', splitPct: 25, estimated: true }],
    analyst: null, eps: null,
  },
  {
    t: 'VHYL.L', label: 'VHYL', n: 'Vanguard FTSE All-World High Div Yield (Dist)', w: 6, exch: 'LSE', isIndexFund: true, defaultCurrency: 'GBP',
    yieldPct: 2.5, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Mar, Jun, Sep, Dec', splitPct: 25, estimated: true }],
    analyst: null, eps: null,
  },
  {
    t: 'ISF.L', label: 'ISF', n: 'iShares Core FTSE 100 (Dist)', w: 5, exch: 'LSE', isIndexFund: true, defaultCurrency: 'GBP',
    yieldPct: 3.0, frequency: 'Quarterly',
    payments: [
      { label: 'Q2', exDiv: '2026-06-18', pay: '2026-06-30', splitPct: 25, estimated: true },
      { label: 'Q3', exDiv: '2026-09-17', pay: '2026-09-30', splitPct: 25, estimated: true },
      { label: 'Q4', exDiv: '2026-12-17', pay: '2026-12-31', splitPct: 25, estimated: true },
      { label: 'Q1', exDiv: '2027-03-18', pay: '2027-03-31', splitPct: 25, estimated: true },
    ],
    analyst: null, eps: null,
  },
  {
    t: 'BATS.L', label: 'BATS', n: 'British American Tobacco', w: 4, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 5.5, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Feb, May, Aug, Nov', splitPct: 25, estimated: true }],
    analyst: { lowPct: 1, highPct: 2, note: 'Defensive, income-led name — consensus sees it as roughly flat on price, not a big mover either way.', asOf: '2026-06-25' },
    eps: { note: 'Earnings broadly stable; not the kind of name with large surprise swings.' },
  },
  {
    t: 'AZN.L', label: 'AZN', n: 'AstraZeneca', w: 3, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 1.7, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 4, highPct: 10, note: 'Pipeline-driven — genuinely two-sided, trial readouts can move this sharply in either direction.', asOf: '2026-06-25' },
    eps: { note: 'Trailing P/E ~29x vs forward ~18x implies a large expected earnings step-up from pipeline maturation.' },
  },
  {
    t: 'CCH.L', label: 'CCH', n: 'Coca-Cola HBC', w: 3, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 2.3, frequency: 'Semi-annual (typical for the sector)',
    payments: [{ label: 'Typical', months: 'May & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 2, highPct: 4, note: 'Steady bottler economics, no major catalysts currently flagged by strategists.', asOf: '2026-06-25' },
    eps: { note: 'No reliable EPS-surprise feed found free for this name — earnings have historically been steady, low-volatility.' },
  },
  {
    t: 'HSBA.L', label: 'HSBA', n: 'HSBC', w: 3, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 3.9, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Feb, May, Aug, Nov', splitPct: 25, estimated: true }],
    analyst: { lowPct: 8, highPct: 12, note: 'Flagged as a likely large 2026 dividend-grower; one model also flagged shares as "stretched" on rising bad-debt risk — two-sided.', asOf: '2026-06-25' },
    eps: { note: 'Trailing P/E ~14.9x vs forward ~10.5x implies ~40%+ expected earnings growth — a large gap worth treating cautiously.' },
  },
  {
    t: 'INTC', label: 'INTC', n: 'Intel', w: 3, exch: 'US', isIndexFund: false, defaultCurrency: 'USD',
    yieldPct: 0, frequency: 'Suspended (since Dec 2024)',
    payments: [], analyst: { lowPct: null, highPct: null, note: 'Live analyst data fetched directly — see chart below.', asOf: 'live' }, eps: { note: 'Live EPS actual-vs-estimate fetched directly — see chart below.' },
  },
  {
    t: 'NG.L', label: 'NG', n: 'National Grid', w: 3, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 3.9, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Feb & Aug', splitPct: 50, estimated: true }],
    analyst: { lowPct: 0, highPct: 4, note: 'Recently downgraded to Hold with a trimmed price target — soft near-term outlook for a regulated utility.', asOf: '2026-06-25' },
    eps: { note: 'Regulated-asset earnings — low volatility, modest growth (typically 2–5%/yr).' },
  },
  {
    t: 'RIO.L', label: 'RIO', n: 'Rio Tinto', w: 3, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 4.1, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 0, highPct: 4, note: 'One valuation model flags shares as "significantly overvalued" — limited multiple-expansion case, commodity-price dependent.', asOf: '2026-06-25' },
    eps: { note: 'Earnings highly correlated to iron ore / copper prices — genuinely volatile, not a steady-grower.' },
  },
  {
    t: 'BP.L', label: 'BP', n: 'BP', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 5.3, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Feb, May, Aug, Nov', splitPct: 25, estimated: true }],
    analyst: { lowPct: 0, highPct: 8, note: 'Heavily oil-price dependent — recent Brent weakness is a headwind; wide range of plausible outcomes.', asOf: '2026-06-25' },
    eps: { note: 'Trailing P/E distorted by one-off items (~35x); forward P/E ~8.7x implies the market expects a sharp earnings recovery.' },
  },
  {
    t: 'ULVR.L', label: 'ULVR', n: 'Unilever', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 4.0, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Mar, Jun, Sep, Dec', splitPct: 25, estimated: true }],
    analyst: { lowPct: 1, highPct: 6, note: 'One broker recently cut its price target — soft signal, though shares trade close to fair-value estimates.', asOf: '2026-06-25' },
    eps: { note: 'Steady consumer-staples earnings, typically low-single-digit growth.' },
  },
  {
    t: 'GSK.L', label: 'GSK', n: 'GSK', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 3.4, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Feb, May, Aug, Nov', splitPct: 25, estimated: true }],
    analyst: { lowPct: 0, highPct: 5, note: 'Broadly neutral/Hold consensus — no strong directional view currently.', asOf: '2026-06-25' },
    eps: { note: 'Pharma pipeline catalysts possible but nothing major flagged as imminent.' },
  },
  {
    t: 'MNG.L', label: 'MNG', n: 'M&G', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 7.9, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Aug', splitPct: 50, estimated: true }],
    analyst: { lowPct: 2, highPct: 10, note: 'UK financials sector tailwind for 2026; payout ratio is stretched (dividend exceeds earnings in places) — watch sustainability.', asOf: '2026-06-25' },
    eps: { note: 'High yield partly reflects market pricing in dividend-cut risk — treat the 7.9% headline with some caution.' },
  },
  {
    t: 'SSE.L', label: 'SSE', n: 'SSE', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 2.9, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 0, highPct: 3, note: 'Recent equity raise (dilutive) and a profit dip are mild near-term negatives.', asOf: '2026-06-25' },
    eps: { note: 'Capital-intensive renewables build-out — earnings growth exists but is being reinvested heavily.' },
  },
  {
    t: 'ABDN.L', label: 'SDLF', n: 'Standard Life (abrdn)', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 8.0, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Aug', splitPct: 50, estimated: true }],
    analyst: { lowPct: 3, highPct: 10, note: 'Asset-manager turnaround story riding the same UK-financials tailwind as the banks/insurers in this pie.', asOf: '2026-06-25' },
    eps: { note: 'High headline yield (~8%) — verify sustainability before treating as guaranteed income.' },
  },
  {
    t: 'BARC.L', label: 'BARC', n: 'Barclays', w: 2, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 2.6, frequency: 'Semi-annual',
    payments: [{ label: 'Typical', months: 'Mar & Aug', splitPct: 50, estimated: true }],
    analyst: { lowPct: 5, highPct: 11, note: 'Flagged for above-average 2026 dividend growth alongside Lloyds — favourable sector backdrop.', asOf: '2026-06-25' },
    eps: { note: 'Investment-banking-linked earnings, more cyclical than the pure UK retail banks.' },
  },
  {
    t: 'GAW.L', label: 'GAW', n: 'Games Workshop', w: 1, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 3.0, frequency: 'Semi-annual + occasional specials',
    payments: [{ label: 'Typical', months: 'Apr & Nov', splitPct: 50, estimated: true }],
    analyst: { lowPct: 3, highPct: 6, note: 'Mature, high-quality, slow-growth — historically resilient through cycles.', asOf: '2026-06-25' },
    eps: { note: 'Known for consistently beating its own conservative guidance; no live surprise feed available free for this name.' },
  },
  {
    t: 'KLAC', label: 'KLAC', n: 'KLA Corp', w: 1, exch: 'US', isIndexFund: false, defaultCurrency: 'USD',
    yieldPct: 0.7, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Mar, Jun, Sep, Dec', splitPct: 25, estimated: true }],
    analyst: { lowPct: null, highPct: null, note: 'Live analyst data fetched directly — see chart below.', asOf: 'live' }, eps: { note: 'Live EPS actual-vs-estimate fetched directly — see chart below.' },
  },
  {
    t: 'NXT.L', label: 'NXT', n: 'Next', w: 1, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 2.0, frequency: 'Semi-annual + occasional specials',
    payments: [{ label: 'Typical', months: 'Apr & Sep', splitPct: 50, estimated: true }],
    analyst: { lowPct: 8, highPct: 12, note: 'Recently upgraded to Buy with raised guidance — one of the more genuinely positive fundamental stories in this pie.', asOf: '2026-06-25' },
    eps: { note: 'Track record of beating its own guidance in recent quarters.' },
  },
  {
    t: 'PHP.L', label: 'PHP', n: 'Primary Health Properties', w: 1, exch: 'LSE', isIndexFund: false, defaultCurrency: 'GBp',
    yieldPct: 7.0, frequency: 'Quarterly',
    payments: [{ label: 'Typical', months: 'Feb, May, Aug, Nov', splitPct: 25, estimated: true }],
    analyst: { lowPct: 2, highPct: 9, note: 'Defensive healthcare REIT — fair-value estimates nudged lower by one model, but rent-backed income is relatively stable.', asOf: '2026-06-25' },
    eps: { note: 'REIT earnings move with rental income and financing costs more than typical EPS surprises.' },
  },
];

module.exports = { ukDividendPie };
