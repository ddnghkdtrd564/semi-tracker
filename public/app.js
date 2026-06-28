// ============================================================
// FUND TRACKER (shared logic for SEMI / IUSA tabs)
// ============================================================
const fundState = {};
const intervals = {};

function fmtPct(v, withSign){ if(v===null||v===undefined) return '—'; const s=(v>0&&withSign)?'+':''; return s+v.toFixed(2)+'%'; }
function moveClass(v){ if(v===null||v===undefined) return 'flat'; if(v>0.05) return 'up'; if(v<-0.05) return 'down'; return 'flat'; }

function fundPanelSkeleton(key){
  return `
    <div class="ticker-row">
      <div class="ticker-id"><span class="sym"><span class="live-dot"></span>${key}</span><span class="name" id="${key}-name">loading…</span></div>
    </div>
    <div class="fund-desc" id="${key}-desc"></div>
    <div class="meta-row"><span>LIVE — refreshes every 60s</span><span id="${key}-stamp">loading…</span></div>
    <div class="coverage-card">
      <div class="coverage-title">Fund coverage — what's actually tracked below</div>
      <div class="stack-bar" id="${key}-stackBar"></div>
      <div class="coverage-legend">
        <span><span class="legend-dot" style="background:var(--up)"></span>Tracked, up</span>
        <span><span class="legend-dot" style="background:var(--down)"></span>Tracked, down</span>
        <span><span class="legend-dot" style="background:#9B9B9B"></span>Tracked, flat</span>
        <span><span class="legend-dot" style="background:#232A37"></span>Untracked</span>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Tracked weight</div><div class="value" id="${key}-trackedWeight">—</div><div class="sub">of fund</div></div>
      <div class="stat"><div class="label">Weighted move</div><div class="value" id="${key}-weightedMove">—</div><div class="sub">percentage points</div></div>
      <div class="stat"><div class="label">Implied avg.</div><div class="value" id="${key}-impliedAvg">—</div><div class="sub">across tracked names</div></div>
      <div class="stat"><div class="label">Biggest mover</div><div class="value" id="${key}-biggestMover">—</div><div class="sub" id="${key}-biggestMoverSub"></div></div>
    </div>
    <div class="table-card">
      <table>
        <thead><tr>
          <th data-sort="weight">Weight ▾</th><th>Ticker</th>
          <th class="num" data-sort="move">Move</th><th class="num" data-sort="contrib">Contribution</th>
        </tr></thead>
        <tbody id="${key}-tbody"><tr><td colspan="4" style="text-align:center; padding:30px; color:var(--faint); font-family:var(--mono);">Loading live quotes…</td></tr></tbody>
      </table>
    </div>
    <div class="refresh-note">Auto-refreshing every 60 seconds. The server calls the price API once a minute per fund regardless of visitor count.</div>
    <div class="foot"><strong>Why some rows show "—":</strong> exchanges the free-tier feed doesn't cover live, plus smaller long-tail holdings.<br><strong>Not financial advice.</strong></div>
  `;
}

async function loadFund(key){
  const panel = document.getElementById('panel-' + key);
  if (!panel.dataset.built){ panel.innerHTML = fundPanelSkeleton(key); panel.dataset.built = '1'; bindSort(key); }
  try{
    const res = await fetch('/api/snapshot/' + key);
    const data = await res.json();
    if (data.error){ document.getElementById(key+'-tbody').innerHTML = `<tr><td colspan="4" style="padding:20px; color:var(--down);">⚠ ${data.error}</td></tr>`; return; }
    fundState[key] = fundState[key] || { curSort:'weight', curDir:1 };
    fundState[key].lastData = data;
    document.getElementById(key+'-name').textContent = data.name + ' · ' + data.exchange;
    document.getElementById(key+'-desc').textContent = data.description;
    renderFund(key);
  }catch(e){
    document.getElementById(key+'-tbody').innerHTML = `<tr><td colspan="4" style="padding:20px; color:var(--down);">⚠ Could not reach server: ${e.message}</td></tr>`;
  }
}

function bindSort(key){
  document.querySelectorAll('#panel-'+key+' th[data-sort]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const st = fundState[key];
      const k = th.dataset.sort;
      st.curDir = (st.curSort===k) ? -st.curDir : 1;
      st.curSort = k;
      renderFund(key);
    });
  });
}

function renderFund(key){
  const st = fundState[key];
  if (!st || !st.lastData) return;
  const data = st.lastData;
  const holdings = data.holdings;
  let trackedW=0, contribSum=0, biggest=null;
  holdings.forEach(h=>{
    if(h.move!==null){
      trackedW+=h.w; contribSum += h.w*h.move/100;
      if(!biggest || Math.abs(h.move) > Math.abs(biggest.move)) biggest = h;
    }
  });
  document.getElementById(key+'-trackedWeight').textContent = trackedW.toFixed(1)+'%';
  document.getElementById(key+'-weightedMove').textContent = (contribSum>=0?'+':'')+contribSum.toFixed(2)+' pp';
  document.getElementById(key+'-weightedMove').className = 'value ' + (contribSum>=0?'up':'down');
  const implied = trackedW>0 ? contribSum/(trackedW/100) : 0;
  document.getElementById(key+'-impliedAvg').textContent = (implied>=0?'+':'')+implied.toFixed(2)+'%';
  document.getElementById(key+'-impliedAvg').className = 'value ' + (implied>=0?'up':'down');
  if(biggest){
    document.getElementById(key+'-biggestMover').textContent = biggest.t + ' ' + fmtPct(biggest.move, true);
    document.getElementById(key+'-biggestMover').className = 'value ' + moveClass(biggest.move);
    document.getElementById(key+'-biggestMoverSub').textContent = biggest.n;
  }
  document.getElementById(key+'-stamp').textContent = 'Last updated ' + new Date(data.fetchedAt).toLocaleTimeString();

  const stackBar = document.getElementById(key+'-stackBar');
  stackBar.innerHTML = '';
  const all = [...holdings, ...data.untracked.map(u=>({...u, move:null})), {t:'OTHER', n:'Other holdings', w:data.otherWeight, move:null}];
  all.forEach(h=>{
    const seg = document.createElement('div');
    seg.className = 'seg' + (h.move===null ? ' untracked' : '');
    seg.style.width = h.w + '%';
    if(h.move!==null){ seg.style.background = h.move>0.05 ? 'var(--up)' : (h.move<-0.05 ? 'var(--down)' : '#9B9B9B'); }
    seg.title = h.t + ' · ' + h.w.toFixed(2) + '% · ' + (h.move===null?'no live data':fmtPct(h.move,true));
    stackBar.appendChild(seg);
  });

  const rows = [...holdings].sort((a,b)=>{
    const get = x => st.curSort==='move' ? (x.move??-999) : st.curSort==='contrib' ? (x.move===null?-999:x.w*x.move) : x.w;
    return st.curDir*(get(b)-get(a));
  });
  const tbody = document.getElementById(key+'-tbody');
  tbody.innerHTML = '';
  const maxW = Math.max(...holdings.map(h=>h.w));
  rows.forEach(h=>{
    const contrib = h.move!==null ? (h.w*h.move/100) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="weight-bar-bg"><span class="weight-bar-fill" style="width:${(h.w/maxW*100).toFixed(0)}%"></span></span>${h.w.toFixed(2)}%</td>
      <td><span class="sym-cell">${h.t}</span><br><span class="name-cell">${h.n}</span></td>
      <td class="num move ${moveClass(h.move)}">${fmtPct(h.move,true)}</td>
      <td class="num move ${moveClass(contrib)}">${contrib===null?'—':(contrib>=0?'+':'')+contrib.toFixed(3)+' pp'}</td>`;
    tbody.appendChild(tr);
  });
  (data.untracked||[]).forEach(h=>{
    const tr = document.createElement('tr'); tr.className='other-row';
    tr.innerHTML = `<td>${h.w.toFixed(2)}%</td><td><span class="sym-cell">${h.t}</span><br><span class="name-cell">${h.n}</span></td><td class="num">—</td><td class="num">—</td>`;
    tbody.appendChild(tr);
  });
  const otherTr = document.createElement('tr'); otherTr.className='other-row';
  otherTr.innerHTML = `<td>${data.otherWeight.toFixed(2)}%</td><td><span class="sym-cell">OTHER</span><br><span class="name-cell">${data.otherCount} smaller holdings</span></td><td class="num">—</td><td class="num">—</td>`;
  tbody.appendChild(otherTr);
}

function initFundTabs(){
  loadFund('SEMI');
  intervals['SEMI'] = setInterval(()=>loadFund('SEMI'), 60000);
}

function activateFundTab(tab){
  if (!intervals[tab]){
    loadFund(tab);
    intervals[tab] = setInterval(()=>loadFund(tab), 60000);
  }
}
