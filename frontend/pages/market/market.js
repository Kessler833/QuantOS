// ── MARKET PAGE ──────────────────────────────────────────
let heatmapData   = null
let heatmapLoaded = false
let heatmapTf     = '1D'

function initMarket() {
  document.querySelectorAll('.heatmap-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.heatmap-tf-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      heatmapTf = btn.dataset.tf
      if (heatmapLoaded) _renderHeatmap()
    })
  })

  const refreshBtn = document.getElementById('btn-refresh-heatmap')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      heatmapLoaded = false
      heatmapData   = null
      _loadHeatmap()
    })
  }
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

  grid.innerHTML = `
    <div class="heatmap-loading" style="width:100%; padding:40px 20px;">
      <div style="font-size:24px; margin-bottom:16px; text-align:center;">⏳</div>
      
      <div style="width:100%; height:8px; background:#1a1a2e; border-radius:4px; overflow:hidden; margin-bottom:16px;">
        <div id="heatmap-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #7aa2f7, #89b4fa); transition:width 0.3s;"></div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#6c7086; margin-bottom:12px;">
        <div id="heatmap-symbols-count">0 / ? Symbole</div>
        <div id="heatmap-time-estimate">Berechne...</div>
      </div>
      
      <div id="heatmap-progress" style="font-size:12px; color:#89b4fa; text-align:center; font-weight:500;">
        Initialisiere Verbindung zu Alpaca...
      </div>
    </div>`

  const countEl = document.getElementById('heatmap-count')
  if (countEl) countEl.textContent = ''

  const progressEl     = document.getElementById('heatmap-progress')
  const progressBar    = document.getElementById('heatmap-progress-bar')
  const symbolsCount   = document.getElementById('heatmap-symbols-count')
  const timeEstimate   = document.getElementById('heatmap-time-estimate')

  let startTime = null
  let totalSymbols = 0
  let firstBatchTime = null
  let batchTimes = []

  try {
    const response = await fetch('http://localhost:8000/api/heatmap/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alpaca_key: apiKeys.alpacaKey,
        alpaca_secret: apiKeys.alpacaSecret
      })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = '' // Buffer für unvollständige Daten

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // Verarbeite vollständige Events (getrennt durch \n\n)
      const events = buffer.split('\n\n')
      buffer = events.pop() || '' // Letztes (unvollständiges) Element zurück in Buffer

      for (const event of events) {
        if (!event.trim()) continue
        
        const lines = event.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          
          const dataStr = line.substring(6).trim()
          if (!dataStr) continue

          let data
          try {
            data = JSON.parse(dataStr)
          } catch (parseErr) {
            console.warn('[Heatmap] JSON parse error, skipping chunk:', parseErr)
            continue
          }

          if (data.error) {
            throw new Error(data.error)
          }

          if (data.stage === 'symbols') {
            if (data.total) {
              totalSymbols = data.total
              if (symbolsCount) symbolsCount.textContent = `0 / ${totalSymbols.toLocaleString('de-DE')} Symbole`
              if (progressEl) progressEl.textContent = `✅ ${totalSymbols.toLocaleString('de-DE')} handelbare US-Aktien gefunden`
            } else {
              if (progressEl) progressEl.textContent = 'Lade Symbolliste von Alpaca Trading API...'
            }
            if (progressBar) progressBar.style.width = '2%'
            if (timeEstimate) timeEstimate.textContent = 'Berechne...'
            startTime = Date.now()
          }

          if (data.stage === 'loading') {
            const loaded = data.loaded || 0
            const progress = data.progress || 0
            const batch = data.batch || 0
            const totalBatches = data.total_batches || 1
            
            if (symbolsCount) symbolsCount.textContent = `${loaded.toLocaleString('de-DE')} / ${totalSymbols.toLocaleString('de-DE')} Symbole`
            if (progressBar) progressBar.style.width = progress + '%'
            
            if (progressEl) {
              const batchSymbols = Math.min(500, totalSymbols - ((batch - 1) * 500))
              progressEl.textContent = `📊 Batch ${batch}/${totalBatches} • Lade ${batchSymbols} Symbole von Alpaca Data API...`
            }
            
            if (batch === 1 && !firstBatchTime) {
              firstBatchTime = Date.now()
            }
            
            if (batch > 1 && firstBatchTime) {
              const currentTime = Date.now()
              batchTimes.push(currentTime)
              
              const recentBatches = batchTimes.slice(-5)
              let avgBatchTime = 0
              if (recentBatches.length > 1) {
                for (let i = 1; i < recentBatches.length; i++) {
                  avgBatchTime += (recentBatches[i] - recentBatches[i-1]) / 1000
                }
                avgBatchTime /= (recentBatches.length - 1)
              } else {
                avgBatchTime = (currentTime - firstBatchTime) / 1000 / (batch - 1)
              }
              
              const remainingBatches = totalBatches - batch
              const estimatedRemaining = remainingBatches * avgBatchTime
              
              if (timeEstimate && estimatedRemaining > 0) {
                if (estimatedRemaining < 60) {
                  timeEstimate.textContent = `~${Math.ceil(estimatedRemaining)}s`
                } else {
                  const mins = Math.floor(estimatedRemaining / 60)
                  const secs = Math.ceil(estimatedRemaining % 60)
                  timeEstimate.textContent = `~${mins}m ${secs}s`
                }
              }
            } else if (batch === 1) {
              if (timeEstimate) timeEstimate.textContent = '~5-10s'
            }
          }

          if (data.stage === 'calculating') {
            if (progressEl) progressEl.textContent = `🧮 Berechne Veränderungen (1D, 1W, 1M, 1Y)...`
            if (progressBar) progressBar.style.width = '98%'
            if (timeEstimate) timeEstimate.textContent = 'Fast fertig...'
          }

          if (data.stage === 'done') {
            if (progressBar) progressBar.style.width = '100%'
            if (symbolsCount) symbolsCount.textContent = `${data.count.toLocaleString('de-DE')} Symbole geladen`
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
            if (timeEstimate) timeEstimate.textContent = `✅ ${totalTime}s`
            if (progressEl) progressEl.textContent = `🌡️ Heatmap fertig! ${data.count.toLocaleString('de-DE')} Symbole mit Kursdaten bereit.`
            
            heatmapData = data
            heatmapLoaded = true
            
            setTimeout(() => _renderHeatmap(), 400)
          }
        }
      }
    }

  } catch (e) {
    console.error('[Heatmap] Fehler:', e)
    grid.innerHTML = `
      <div class="heatmap-error">
        ❌ ${e.message}
        <br>
        <button onclick="heatmapLoaded=false; heatmapData=null; _loadHeatmap()" style="
          margin-top:14px; background:#1a1a2e; color:#7aa2f7;
          border:1px solid #7aa2f7; padding:6px 16px; border-radius:6px;
          font-size:12px; cursor:pointer;
        ">🔄 Nochmal versuchen</button>
      </div>`
  }
}


function _renderHeatmap() {
  const grid = document.getElementById('heatmap-grid')
  if (!grid || !heatmapData || !heatmapData.symbols) return

  const entries = Object.entries(heatmapData.symbols)
    .filter(([, d]) => d[heatmapTf] !== null && d[heatmapTf] !== undefined)
    .sort((a, b) => (b[1][heatmapTf] || 0) - (a[1][heatmapTf] || 0))

  const countEl = document.getElementById('heatmap-count')
  if (countEl) countEl.textContent = `${entries.length} Symbole`

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
