// ============================================================
// LANDING PAGE
// ============================================================
let landingInterval = null;

function landingSkeleton(){
  return `
    <div class="landing-head">
      <div class="landing-eyebrow">Market overview</div>
      <h1 class="landing-title">Most popular markets, right now.</h1>
      <p class="landing-sub">A live read on six major world indices, plus quick access to everything tracked on this site.</p>
    </div>
    <div class="board" id="marketBoard"></div>
    <div class="landing-links" id="landingLinks"></div>
    <div class="landing-foot">
      Index data via the same live feed used elsewhere on this site — refreshes every 45s. Not financial advice.
    </div>
  `;
}

const NAV_DESTINATIONS = [
  { tab: 'SEMI', title: 'SEMI', desc: 'Global semiconductor ETF — 352 holdings, live coverage tracker.' },
  { tab: 'IUSA', title: 'IUSA', desc: 'iShares Core S&P 500 — top US holdings, live moves.' },
  { tab: 'DIV', title: 'UK Dividend Pie 🥧', desc: '26-holding target-weight pie — dividends, DRIP calculator, analyst views.' },
];

function activateLandingTab(){
  const panel = document.getElementById('panel-LANDING');
  if (!panel.dataset.built){
    panel.innerHTML = landingSkeleton();
    panel.dataset.built = '1';
    document.getElementById('landingLinks').innerHTML = NAV_DESTINATIONS.map(d => `
      <div class="landing-link" data-goto="${d.tab}">
        <div class="eyebrow">Dashboard</div>
        <div class="title">${d.title}</div>
        <div class="desc">${d.desc}</div>
      </div>
    `).join('');
    document.querySelectorAll('.landing-link').forEach(el=>{
      el.addEventListener('click', ()=> navigateTo(el.dataset.goto));
    });
  }
  loadLandingMarkets();
  if (!landingInterval) landingInterval = setInterval(loadLandingMarkets, 45000);
}

async function loadLandingMarkets(){
  const board = document.getElementById('marketBoard');
  if (!board) return;
  if (!board.dataset.loadedOnce){
    board.innerHTML = NAV_DESTINATIONS.length ? '' : '';
    board.innerHTML = Array.from({length:6}).map(()=>`
      <div class="board-cell">
        <div class="name"><span class="skel" style="width:80px;"></span></div>
        <span class="ticker">&nbsp;</span>
        <div class="figure"><span class="skel" style="width:60px; height:1.4em;"></span></div>
      </div>
    `).join('');
  }
  try{
    const res = await fetch('/api/indices');
    const data = await res.json();
    board.dataset.loadedOnce = '1';
    board.innerHTML = data.markets.map(m=>{
      const moveStr = m.move !== null ? (m.move>=0?'+':'') + m.move.toFixed(2) + '%' : '—';
      const cls = m.move === null ? 'flat' : (m.move > 0.02 ? 'up' : (m.move < -0.02 ? 'down' : 'flat'));
      const priceStr = m.price !== null ? m.price.toLocaleString('en-GB', {maximumFractionDigits:2}) : 'unavailable this cycle';
      return `
        <div class="board-cell" data-goto="DIV">
          <div class="name">${m.label}</div>
          <span class="ticker">${m.n}</span>
          <div class="figure ${cls}">${moveStr}</div>
          <div class="price">${priceStr}</div>
        </div>`;
    }).join('');
    document.querySelectorAll('.board-cell').forEach(el=>{
      el.addEventListener('click', ()=> navigateTo(el.dataset.goto));
    });
  }catch(e){
    board.innerHTML = `<div class="board-cell" style="grid-column:1/-1;"><p class="note" style="color:var(--muted); font-size:12px;">Could not load market data: ${e.message}</p></div>`;
  }
}
