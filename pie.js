// ============================================================
// UK DIVIDEND PIE 🥧
// ============================================================
const DIV_STORAGE_KEY = 'portfolio-tracker-invested-amounts';
let pieData = null;
let pieSearchTerm = '';
const chartInstances = {}; // ticker -> {price: Chart, eps: Chart}
const newsLoaded = {};

function loadInvested(){ try{ return JSON.parse(localStorage.getItem(DIV_STORAGE_KEY)) || {}; }catch(e){ return {}; } }
function saveInvested(obj){ try{ localStorage.setItem(DIV_STORAGE_KEY, JSON.stringify(obj)); }catch(e){} }
function fmtMoney(v){ return '£' + v.toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtCompact(v, currency){
  if (v===null||v===undefined) return null;
  const sym = currency==='GBp' ? 'p' : (currency==='USD' ? '$' : (currency||''));
  if (Math.abs(v) >= 1e9) return sym + (v/1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return sym + (v/1e6).toFixed(2) + 'M';
  return sym + v.toFixed(2);
}

async function loadPie(){
  const panel = document.getElementById('panel-DIV');
  if (!panel.dataset.built){ panel.innerHTML = pieSkeleton(); panel.dataset.built = '1'; bindPieToolbar(); }
  try{
    const res = await fetch('/api/pie');
    const data = await res.json();
    if (data.error){
      document.getElementById('pieError').style.display='block';
      document.getElementById('pieError').textContent = '⚠ ' + data.error;
      return;
    }
    document.getElementById('pieError').style.display='none';
    pieData = data.holdings;
    renderPieTable();
  }catch(e){
    document.getElementById('pieError').style.display='block';
    document.getElementById('pieError').textContent = '⚠ Could not reach server: ' + e.message;
  }
}

function pieSkeleton(){
  return `
    <div class="ticker-row"><div class="ticker-id"><span class="sym">UK Dividend Pie 🥧</span></div></div>
    <div class="fund-desc">All 26 holdings at their target weight. Live price + stats where a free feed covers them; dividend dates, analyst views and EPS context for LSE names are curated research (dated, not live-ticking) — never a blank dash.</div>
    <div id="pieError" class="error-banner"></div>

    <div class="pie-toolbar">
      <input type="text" class="search-input" id="pieSearch" placeholder="Search holdings… (e.g. Lloyds, BP, RR.L)">
      <div class="quickfill">
        <span style="font-size:12px; color:var(--muted); font-family:var(--mono);">Quick-fill £</span>
        <input type="number" id="quickfillAmount" placeholder="1800" min="0" step="50">
        <button id="quickfillBtn">Distribute by weight</button>
      </div>
    </div>

    <div class="timeline-card">
      <div class="timeline-title">Upcoming dividend payments</div>
      <div id="pieTimeline"></div>
    </div>

    <div class="table-card" style="margin-bottom:24px;">
      <table>
        <thead><tr>
          <th>Holding</th><th class="num">Weight</th><th class="num">Price</th><th class="num">Move</th>
          <th class="num">Yield</th><th class="num">Invested (£)</th><th class="num">Est. annual £</th>
        </tr></thead>
        <tbody id="pieTbody"></tbody>
      </table>
    </div>

    <div class="drip-card" id="dripCard"></div>

    <div class="foot">
      <strong>How yields/dates work:</strong> LLOY and LGEN use their real historical interim/final split. Most other LSE names assume an even split across the stated frequency with month-level (not day-level) estimates, clearly marked "typical" until the actual date is declared. IUSA/ISF use confirmed quarterly dates where known.<br>
      <strong>How analyst/EPS sections work:</strong> INTC and KLAC (US-listed) pull live analyst targets and EPS actual-vs-estimate. LSE names use dated research notes instead, since no free live feed reliably covers this for UK shares — confirmed by checking several providers' documented limitations.<br><br>
      <strong>Not financial advice.</strong> Yields, targets and dates can all change — boards cut, raise, or reschedule at any time.
    </div>
  `;
}

function bindPieToolbar(){
  document.getElementById('pieSearch').addEventListener('input', (e)=>{
    pieSearchTerm = e.target.value.toLowerCase();
    renderPieTable();
  });
  document.getElementById('quickfillBtn').addEventListener('click', ()=>{
    const total = parseFloat(document.getElementById('quickfillAmount').value) || 0;
    if (total <= 0 || !pieData) return;
    const invested = loadInvested();
    pieData.forEach(h=>{ invested[h.t] = Math.round(total * (h.w/100) * 100) / 100; });
    saveInvested(invested);
    renderPieTable();
  });
}

function renderPieTable(){
  if (!pieData) return;
  const invested = loadInvested();
  const tbody = document.getElementById('pieTbody');
  tbody.innerHTML = '';
  let totalInvested=0, totalAnnual=0;
  const upcoming = [];
  const today = new Date();

  const filtered = pieData.filter(h => !pieSearchTerm ||
    h.label.toLowerCase().includes(pieSearchTerm) || h.n.toLowerCase().includes(pieSearchTerm) || h.t.toLowerCase().includes(pieSearchTerm));

  filtered.forEach(h=>{
    const amt = invested[h.t] || 0;
    const annual = amt * (h.yieldPct/100);
    totalInvested += amt; totalAnnual += annual;

    const priceCell = h.price !== null
      ? `${h.price.toFixed(2)}<span style="color:var(--faint); font-size:10px;"> ${h.priceSource==='yahoo'?'(fallback)':''}</span>`
      : `<span class="skel" style="width:50px;"></span>`;
    const moveCell = h.move !== null ? `<span class="move ${moveClass(h.move)}">${fmtPct(h.move,true)}</span>` : `<span class="skel" style="width:36px;"></span>`;

    const tr = document.createElement('tr');
    tr.className = 'holding-row';
    tr.innerHTML = `
      <td><span class="expand-arrow" id="arrow-${cssSafe(h.t)}">▶</span><span class="sym-cell">${h.label}</span><br><span class="name-cell">${h.n}</span></td>
      <td class="num">${h.w}%</td>
      <td class="num">${priceCell}</td>
      <td class="num">${moveCell}</td>
      <td class="num">${h.yieldPct>0 ? h.yieldPct.toFixed(2)+'%' : (h.isIndexFund && h.yieldPct===0 ? 'Acc' : '0%')}</td>
      <td class="num"><input type="number" class="div-input" data-ticker="${h.t}" placeholder="0" min="0" step="50" value="${amt||''}" onclick="event.stopPropagation()"></td>
      <td class="num move ${annual>0?'up':'flat'}">${annual>0?fmtMoney(annual):'£0.00'}</td>`;
    tr.addEventListener('click', (e)=>{ if(e.target.tagName!=='INPUT') toggleDetail(h.t); });
    tbody.appendChild(tr);

    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row';
    detailTr.id = 'detail-' + cssSafe(h.t);
    detailTr.innerHTML = `<td class="detail-cell" colspan="7"></td>`;
    tbody.appendChild(detailTr);

    h.payments.forEach(p=>{
      if (p.pay){
        const payDate = new Date(p.pay);
        if (payDate >= today && amt > 0) upcoming.push({ ticker:h.label, name:h.n, label:p.label, pay:p.pay, exDiv:p.exDiv, amt: annual*(p.splitPct/100), estimated:p.estimated });
      } else if (p.months && amt > 0) {
        upcoming.push({ ticker:h.label, name:h.n, label:p.label+' ('+p.months+')', payText:'Typical: '+p.months, amt: annual*(p.splitPct/100), estimated:true, noDate:true });
      }
    });
  });

  const totalTr = document.createElement('tr'); totalTr.className='total-row';
  totalTr.innerHTML = `<td colspan="5">TOTAL (filtered)</td><td class="num">${fmtMoney(totalInvested)}</td><td class="num">${fmtMoney(totalAnnual)}</td>`;
  tbody.appendChild(totalTr);

  renderTimeline(upcoming);
  renderDrip(totalInvested, totalAnnual);

  tbody.querySelectorAll('.div-input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const cur = loadInvested();
      cur[inp.dataset.ticker] = parseFloat(inp.value) || 0;
      saveInvested(cur);
      const focusedTicker = inp.dataset.ticker;
      renderPieTable();
      const el = document.querySelector('.div-input[data-ticker="'+focusedTicker+'"]');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  });
}

function cssSafe(t){ return t.replace(/[^a-zA-Z0-9]/g, '_'); }

function renderTimeline(upcoming){
  const dated = upcoming.filter(u=>!u.noDate).sort((a,b)=> new Date(a.pay) - new Date(b.pay));
  const undated = upcoming.filter(u=>u.noDate);
  const timeline = document.getElementById('pieTimeline');
  const today = new Date();

  if (dated.length===0 && undated.length===0){
    timeline.innerHTML = `<div class="empty-state">Enter an amount invested below (or use Quick-fill) to see your upcoming dividend payments here.</div>`;
    return;
  }
  let html = dated.map(u=>{
    const daysAway = Math.round((new Date(u.pay) - today) / 86400000);
    const soon = daysAway <= 30;
    return `<div class="timeline-item">
      <div class="timeline-date ${soon?'soon':''}">${new Date(u.pay).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
      <div class="timeline-tick"></div>
      <div class="timeline-detail">${u.ticker} — ${u.label}${u.estimated?' <span style="color:var(--faint)">(est.)</span>':''}<br><span style="color:var(--muted); font-size:11.5px;">ex-div ${new Date(u.exDiv).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · ${daysAway} days away</span></div>
      <div class="timeline-amt">${fmtMoney(u.amt)}</div></div>`;
  }).join('');
  if (undated.length){
    html += undated.map(u=>`<div class="timeline-item">
      <div class="timeline-date" style="color:var(--faint);">~Est.</div>
      <div class="timeline-tick" style="background:var(--faint);"></div>
      <div class="timeline-detail">${u.ticker} — ${u.payText}<br><span style="color:var(--muted); font-size:11.5px;">exact date not yet declared</span></div>
      <div class="timeline-amt">${fmtMoney(u.amt)}</div></div>`).join('');
  }
  timeline.innerHTML = html;
}

// ---- Accordion detail: analyst chart, EPS, stats, news ----
async function toggleDetail(ticker){
  const row = document.getElementById('detail-' + cssSafe(ticker));
  const arrow = document.getElementById('arrow-' + cssSafe(ticker));
  const isOpen = row.classList.contains('open');
  if (isOpen){ row.classList.remove('open'); arrow.classList.remove('open'); return; }
  row.classList.add('open'); arrow.classList.add('open');
  const cell = row.querySelector('.detail-cell');
  if (!cell.dataset.built){
    cell.dataset.built = '1';
    const h = pieData.find(x=>x.t===ticker);
    cell.innerHTML = buildDetailHTML(h);
    requestAnimationFrame(()=>renderDetailCharts(h));
    loadNewsFor(h);
  }
}

function buildDetailHTML(h){
  const statsHTML = h.stats ? `
    <div class="mini-stats">
      <div class="mini-stat"><span class="l">Market Cap</span>${fmtCompact(h.stats.marketCap, h.stats.currency) ?? '<span class="skel" style="width:50px;"></span>'}</div>
      <div class="mini-stat"><span class="l">P/E Ratio</span>${h.stats.peRatio ? h.stats.peRatio.toFixed(1)+'x' : 'N/A for this name'}</div>
      <div class="mini-stat"><span class="l">52wk Low</span>${h.stats.fiftyTwoWeekLow ? h.stats.fiftyTwoWeekLow.toFixed(2) : '—'}</div>
      <div class="mini-stat"><span class="l">52wk High</span>${h.stats.fiftyTwoWeekHigh ? h.stats.fiftyTwoWeekHigh.toFixed(2) : '—'}</div>
      <div class="mini-stat"><span class="l">Volume</span>${h.stats.volume ? h.stats.volume.toLocaleString() : '—'}</div>
      <div class="mini-stat"><span class="l">Currency</span>${h.stats.currency || 'Unknown'}</div>
    </div>` : `<p class="note">Stats feed didn't return data for this ticker this refresh — try again shortly.</p>`;

  let analystHTML;
  if (h.isIndexFund){
    analystHTML = `<p>This is an index fund — it tracks a benchmark rather than being a single company, so individual analyst price targets don't apply here.</p>`;
  } else if (h.exch === 'US') {
    analystHTML = `<div class="chart-wrap"><canvas id="chart-analyst-${cssSafe(h.t)}"></canvas></div><p class="note">Live consensus from Finnhub.</p>`;
  } else {
    analystHTML = `<div class="chart-wrap"><canvas id="chart-analyst-${cssSafe(h.t)}"></canvas></div><p class="note">${h.analyst ? h.analyst.note + ' (curated, as of ' + h.analyst.asOf + ')' : 'No analyst view curated for this name yet.'}</p>`;
  }

  let epsHTML;
  if (h.isIndexFund){
    epsHTML = `<p>Index funds don't report a single-company EPS — this section applies to individual stocks only.</p>`;
  } else if (h.exch === 'US' && h.liveEarnings && h.liveEarnings.length){
    epsHTML = `<div class="chart-wrap"><canvas id="chart-eps-${cssSafe(h.t)}"></canvas></div><p class="note">Live actual vs. estimate, last 4 reported quarters (Finnhub).</p>`;
  } else {
    epsHTML = `<p>${h.eps ? h.eps.note : 'No EPS context curated for this name yet.'}</p><p class="note">Live actual-vs-estimate EPS feeds for LSE-listed names aren't reliably available on free data tiers.</p>`;
  }

  return `<div class="detail-inner">
    <div class="detail-grid">
      <div class="detail-card"><h4>Analyst View · 12-month</h4>${analystHTML}</div>
      <div class="detail-card"><h4>EPS — Actual vs Expected</h4>${epsHTML}</div>
      <div class="detail-card"><h4>Key Stats</h4>${statsHTML}</div>
      <div class="detail-card"><h4>Recent News</h4><div id="news-${cssSafe(h.t)}"><div class="empty-note">Loading news…</div></div></div>
    </div>
  </div>`;
}

function renderDetailCharts(h){
  if (!window.Chart) return;
  const gridColor = getComputedStyle(document.body).getPropertyValue('--line').trim();
  const textColor = getComputedStyle(document.body).getPropertyValue('--muted').trim();
  const baseOpts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textColor, font:{size:10}}}}, scales:{x:{ticks:{color:textColor, font:{size:10}}, grid:{color:gridColor}}, y:{ticks:{color:textColor, font:{size:10}}, grid:{color:gridColor}}} };

  // Analyst chart
  if (!h.isIndexFund){
    const canvas = document.getElementById('chart-analyst-' + cssSafe(h.t));
    if (canvas){
      let labels, values, colors;
      if (h.exch === 'US' && h.liveAnalyst && h.liveAnalyst.targetMean){
        labels = ['Current', 'Target Low', 'Target Mean', 'Target High'];
        values = [h.price, h.liveAnalyst.targetLow, h.liveAnalyst.targetMean, h.liveAnalyst.targetHigh];
        colors = ['#E0A93D', '#7C8699', '#3ED98E', '#3ED98E'];
      } else if (h.analyst && h.analyst.lowPct !== null && h.price) {
        labels = ['Current', 'Implied Low', 'Implied High'];
        values = [h.price, h.price*(1+h.analyst.lowPct/100), h.price*(1+h.analyst.highPct/100)];
        colors = ['#E0A93D', '#7C8699', '#3ED98E'];
      }
      if (values && values.every(v=>typeof v==='number')){
        chartInstances[h.t] = chartInstances[h.t] || {};
        chartInstances[h.t].price = new Chart(canvas, { type:'bar', data:{ labels, datasets:[{ data:values, backgroundColor:colors }]}, options:{...baseOpts, plugins:{legend:{display:false}}} });
      } else {
        canvas.parentElement.innerHTML = '<p class="note">Not enough live price data yet to plot this — refreshes within 60s.</p>';
      }
    }
  }

  // EPS chart
  if (h.exch === 'US' && h.liveEarnings && h.liveEarnings.length){
    const canvas = document.getElementById('chart-eps-' + cssSafe(h.t));
    if (canvas){
      const sorted = [...h.liveEarnings].reverse();
      chartInstances[h.t] = chartInstances[h.t] || {};
      chartInstances[h.t].eps = new Chart(canvas, {
        type:'bar',
        data:{ labels: sorted.map(e=>e.period), datasets:[
          { label:'Estimate', data: sorted.map(e=>e.estimate), backgroundColor:'#3A4254' },
          { label:'Actual', data: sorted.map(e=>e.actual), backgroundColor:'#3ED98E' },
        ]},
        options: baseOpts,
      });
    }
  }
}

async function loadNewsFor(h){
  const target = document.getElementById('news-' + cssSafe(h.t));
  try{
    const res = await fetch('/api/news/' + encodeURIComponent(h.t));
    const data = await res.json();
    if (data.error){ target.innerHTML = `<p class="note">News feed unavailable right now: ${data.error}</p>`; return; }
    if (!data.items || data.items.length===0){ target.innerHTML = `<div class="empty-note">No recent news found for this name in the last two weeks.</div>`; return; }
    target.innerHTML = data.items.map(n=>`<div class="news-item"><a href="${n.url}" target="_blank" rel="noopener">${n.headline}</a><div class="news-meta">${n.source} · ${new Date(n.datetime).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></div>`).join('');
  }catch(e){
    target.innerHTML = `<p class="note">Could not load news: ${e.message}</p>`;
  }
}

// ============================================================
// DRIP CALCULATOR
// ============================================================
function renderDrip(totalInvested, totalAnnual){
  const card = document.getElementById('dripCard');
  const blendedYield = totalInvested > 0 ? (totalAnnual/totalInvested*100) : 5;
  const existing = card.dataset.built;
  if (!existing){
    card.dataset.built = '1';
    card.innerHTML = `
      <div class="drip-title">Dividend &amp; DRIP Calculator</div>
      <div class="drip-sub">Defaults use your total invested + blended yield from the table above — adjust anything below.</div>
      <div class="drip-controls">
        <div class="drip-field"><label>Starting amount (£)</label><input type="number" id="dripAmount" min="0" step="50"></div>
        <div class="drip-field"><label>Years</label><input type="number" id="dripYears" min="1" max="40" value="10"></div>
        <div class="drip-field"><label>Dividend yield (%)</label><input type="number" id="dripYield" min="0" max="20" step="0.1"></div>
        <div class="drip-field"><label>Assumed price growth (%/yr)</label><input type="number" id="dripGrowth" min="-20" max="30" step="0.5" value="3"></div>
      </div>
      <div class="drip-results" id="dripResultsRow"></div>
      <div class="drip-chart-wrap"><canvas id="dripChart"></canvas></div>
      <p class="foot" style="margin-top:14px;">Simple model: quarterly compounding, dividends reinvested at the same yield (DRIP) vs. paid out as uninvested cash (No DRIP). Real returns will vary — this is illustrative, not a forecast.</p>
    `;
    document.getElementById('dripAmount').addEventListener('input', updateDrip);
    document.getElementById('dripYears').addEventListener('input', updateDrip);
    document.getElementById('dripYield').addEventListener('input', updateDrip);
    document.getElementById('dripGrowth').addEventListener('input', updateDrip);
  }
  // keep defaults in sync with table totals unless user has typed something
  const amountInput = document.getElementById('dripAmount');
  const yieldInput = document.getElementById('dripYield');
  if (!amountInput.dataset.touched) amountInput.value = totalInvested.toFixed(2);
  if (!yieldInput.dataset.touched) yieldInput.value = blendedYield.toFixed(2);
  ['dripAmount','dripYield'].forEach(id=>{
    document.getElementById(id).addEventListener('input', (e)=>{ e.target.dataset.touched='1'; }, {once:true});
  });
  updateDrip();
}

function updateDrip(){
  const P = parseFloat(document.getElementById('dripAmount').value) || 0;
  const years = parseInt(document.getElementById('dripYears').value) || 10;
  const y = (parseFloat(document.getElementById('dripYield').value) || 0) / 100;
  const g = (parseFloat(document.getElementById('dripGrowth').value) || 0) / 100;
  const n = 4; // quarterly compounding
  const periods = years * n;

  const dripSeries = [P]; const noDripSeries = [P];
  let dripVal = P, capital = P, cashDivs = 0;
  for (let i=1; i<=periods; i++){
    dripVal *= (1 + g/n + y/n);
    cashDivs += capital * (y/n);
    capital *= (1 + g/n);
    if (i % n === 0){ dripSeries.push(dripVal); noDripSeries.push(capital + cashDivs); }
  }

  const finalDrip = dripSeries[dripSeries.length-1];
  const finalNoDrip = noDripSeries[noDripSeries.length-1];
  document.getElementById('dripResultsRow').innerHTML = `
    <div class="drip-result"><div class="l">With DRIP (${years}y)</div><div class="v" style="color:var(--up);">${fmtMoney(finalDrip)}</div></div>
    <div class="drip-result"><div class="l">Without DRIP (${years}y)</div><div class="v">${fmtMoney(finalNoDrip)}</div></div>
    <div class="drip-result"><div class="l">DRIP advantage</div><div class="v" style="color:var(--amber);">${fmtMoney(finalDrip-finalNoDrip)}</div></div>
  `;

  const labels = Array.from({length: years+1}, (_,i)=>'Yr '+i);
  if (chartInstances._drip) chartInstances._drip.destroy();
  const gridColor = getComputedStyle(document.body).getPropertyValue('--line').trim();
  const textColor = getComputedStyle(document.body).getPropertyValue('--muted').trim();
  chartInstances._drip = new Chart(document.getElementById('dripChart'), {
    type:'line',
    data:{ labels, datasets:[
      { label:'With DRIP', data:dripSeries, borderColor:'#3ED98E', backgroundColor:'rgba(62,217,142,0.08)', fill:true, tension:0.25 },
      { label:'Without DRIP', data:noDripSeries, borderColor:'#7C8699', backgroundColor:'rgba(124,134,153,0.05)', fill:true, tension:0.25 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:textColor } } },
      scales:{ x:{ ticks:{ color:textColor }, grid:{ color:gridColor } }, y:{ ticks:{ color:textColor, callback:(v)=>'£'+v.toLocaleString() }, grid:{ color:gridColor } } } }
  });
}
