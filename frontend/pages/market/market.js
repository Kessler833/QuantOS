// ── MARKET PAGE ──────────────────────────────────────────
let heatmapData   = null
let heatmapLoaded = false
let heatmapTf     = '1D'

function initMarket() {
  const container = document.getElementById('page-market')
  if (!container) return

  container.innerHTML = `
    <div class="market-container">
      <div class="market-header">
        <span class="market-title">🌡️ Market Heatmap</span>
        <div class="heatmap-tf-group">
          <button class="heatmap-tf-btn active" data-tf="1D">D</button>
          <button class="heatmap-tf-btn" data-tf="1W">W</button>
          <button class="heatmap-tf-btn" data-tf="1M">M</button>
          <button class="heatmap-tf-btn" data-tf="1Y">Y</button>
        </div>
        <span class="heatmap-count" id="heatmap-count"></span>
        <span class="heatmap-delay-hint">⏱ Delayed ~75 min</span>
        <button class="heatmap-refresh-btn" id="btn-refresh-heatmap">🔄 Refresh</button>
      </div>
      <div id="heatmap-grid">
        <div class="heatmap-placeholder">🌡️ Market Tab öffnen um Daten zu laden</div>
      </div>
    </div>`

  document.querySelectorAll('.heatmap-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.heatmap-tf-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      heatmapTf = btn.dataset.tf
      if (heatmapLoaded) _renderHeatmap()
    })
  })

  document.getElementById('btn-refresh-heatmap').addEventListener('click', () => {
    heatmapLoaded = false
    heatmapData   = null
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
  if (!grid) return

  if (!apiKeys.alpacaKey || !apiKeys.alpacaSecret) {
    grid.innerHTML = `
      <div class="heatmap-no-api">
        🔐 Keine API-Keys konfiguriert
        <br>
        <button onclick="navigateTo('synchro')" style="
          margin-top:14px; background:#7aa2f7; color:#0a0a14;
          border:none; padding:8px 20px; border-radius:6px;
          font-size:13px; font-weight:700; cursor:pointer;
        ">Zu Data & Synchro →</button>
      </div>`
    return
  }

  grid.innerHTML = '<div class="heatmap-loading">⏳ Lade Marktdaten… kann bis zu 30s dauern</div>'
  document.getElementById('heatmap-count').textContent = ''

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
  if (!grid || !heatmapData || !heatmapData.symbols) return

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
  const p = Math.max(-8, Math.min(8, pct))
  if (p >= 0) {
    const t = p / 8
    const r = Math.round(22  + (38  - 22)  * t)
    const g = Math.round(160 + (200 - 160) * t)
    const b = Math.round(130 + (80  - 130) * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = (-p) / 8
    const r = Math.round(22  + (230 - 22)  * t)
    const g = Math.round(160 + (50  - 160) * t)
    const b = Math.round(130 + (50  - 130) * t)
    return `rgb(${r},${g},${b})`
  }
}
