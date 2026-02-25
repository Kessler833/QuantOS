// ══════════════════════════════════════════════
//  Market Page – Heatmap
// ══════════════════════════════════════════════

let heatmapData     = null
let heatmapTf       = '1D'
let heatmapLoaded   = false

function initMarket() {
  document.querySelectorAll('.heatmap-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.heatmap-tf-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      heatmapTf = btn.dataset.tf
      if (heatmapData) _renderHeatmap()
    })
  })

  document.getElementById('btn-refresh-heatmap').addEventListener('click', () => {
    heatmapLoaded = false
    _loadHeatmap()
  })
}

function onMarketActivated() {
  if (!heatmapLoaded) _loadHeatmap()
}

async function _loadHeatmap() {
  const cached  = QuantCache.load()
  const apiKeys = (cached && cached.api) ? cached.api : {}
  const grid    = document.getElementById('heatmap-grid')

  if (!apiKeys.alpacaKey || !apiKeys.alpacaSecret) {
    grid.innerHTML = `
      <div class="heatmap-no-api">
        🔐 Keine API-Keys konfiguriert
        <br>
        <button onclick="navigateTo('synchro')" style="
          margin-top:14px;
          background:#7aa2f7;
          color:#0a0a14;
          border:none;
          padding:8px 20px;
          border-radius:6px;
          font-size:13px;
          font-weight:700;
          cursor:pointer;
        ">Zu Data & Synchro →</button>
      </div>`
    return
  }

  grid.innerHTML = '<div class="heatmap-loading">⏳ Lade Marktdaten… kann bis zu 30s dauern</div>'
  document.getElementById('heatmap-count').textContent = ''
  document.getElementById('heatmap-delay-hint').style.display = 'inline'

  try {
    heatmapData   = await apiHeatmap({ alpaca_key: apiKeys.alpacaKey, alpaca_secret: apiKeys.alpacaSecret })
    heatmapLoaded = true
    _renderHeatmap()
  } catch (e) {
    grid.innerHTML = `<div class="heatmap-error">❌ ${e.message}</div>`
  }
}


function _renderHeatmap() {
  const grid = document.getElementById('heatmap-grid')
  if (!heatmapData || !heatmapData.symbols) return

  const entries = Object.entries(heatmapData.symbols)
    .filter(([, d]) => d[heatmapTf] !== null && d[heatmapTf] !== undefined)
    .sort((a, b) => (b[1][heatmapTf] || 0) - (a[1][heatmapTf] || 0))

  document.getElementById('heatmap-count').textContent = `${entries.length} Symbole`

  grid.innerHTML = entries.map(([sym, data]) => {
    const pct  = data[heatmapTf]
    const sign = pct >= 0 ? '+' : ''
    return `
      <div class="heatmap-cell" style="background:${_heatColor(pct)}"
           title="${sym}  ${sign}${pct}%  |  $${data.price}"
           onclick="navigateTo('backtest'); setTimeout(() => {
             const el = document.getElementById('ctrl-symbol');
             if (el) el.value = '${sym}';
           }, 80)">
        <div class="heatmap-symbol">${sym}</div>
        <div class="heatmap-pct">${sign}${pct}%</div>
      </div>`
  }).join('')
}

function _heatColor(pct) {
  const v = Math.max(-10, Math.min(10, pct || 0))
  if (v >= 0) {
    const t = v / 10
    return `rgb(${Math.round(15 + t * 23)},${Math.round(15 + t * 151)},${Math.round(20 + t * 134)})`
  } else {
    const t = Math.abs(v) / 10
    return `rgb(${Math.round(15 + t * 224)},${Math.round(15 + t * 68)},${Math.round(20 + t * 60)})`
  }
}
