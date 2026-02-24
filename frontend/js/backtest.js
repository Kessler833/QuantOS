// ══════════════════════════════════════════════
//  Backtest Page – Charts, Controls & Rendering
// ══════════════════════════════════════════════

let activeIndicators = []
let splitInitialized = false
let lastEquityData = null
let equityResizeTimer = null
let vertSplit = null
let clampingPerf = false

// ── LIGHTWEIGHT CHARTS STATE ──────────────────────────────
let lwChart = null
let lwCandleSeries = null
let lwIndicatorSeries = []

// ── PLOTLY STATE ──────────────────────────────────────────
let equityRelayoutGuard = false

// ══════════════════════════════════════════════════════════
//  CACHE HELPERS – alle try-catch, schlagen nie durch
// ══════════════════════════════════════════════════════════
function _cacheLoad() {
  try {
    if (typeof QuantCache === 'undefined') return null;
    return QuantCache.load();
  } catch (e) { return null; }
}

function _cacheRestoreParams() {
  try {
    var c = _cacheLoad();
    if (!c) return;
    var p = c.params;

    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    set('ctrl-symbol', p.symbol);
    set('ctrl-interval', p.interval);
    set('ctrl-start', p.start);
    set('ctrl-end', p.end);
    set('ctrl-capital', p.capital);
    set('ctrl-sma', p.sma);

    // Strategie NACH dem Befüllen des Dropdowns setzen
    if (p.strategy) {
      var stratEl = document.getElementById('ctrl-strategy');
      if (stratEl) stratEl.value = p.strategy;
    }

    // Aktive Indikatoren
    if (Array.isArray(p.indicators) && p.indicators.length > 0) {
      activeIndicators = p.indicators.slice();
      renderIndicatorTags();
    }
  } catch (e) {
    console.warn('[Cache] _cacheRestoreParams fehlgeschlagen:', e);
  }
}

function _cacheSaveParams() {
  try {
    if (typeof QuantCache === 'undefined') return;
    var get = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    QuantCache.saveParams({
      symbol: get('ctrl-symbol') || 'SPY',
      interval: get('ctrl-interval') || '1d',
      start: get('ctrl-start') || '2024-01-01',
      end: get('ctrl-end') || '2025-01-01',
      capital: parseFloat(get('ctrl-capital')) || 10000,
      sma: parseInt(get('ctrl-sma')) || 20,
      strategy: get('ctrl-strategy') || '',
      indicators: activeIndicators.slice()
    });
  } catch (e) {
    console.warn('[Cache] _cacheSaveParams fehlgeschlagen:', e);
  }
}

// ── HELPERS ───────────────────────────────────────────────
function toUnixTime(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000)
}

// ── CONSTRAINTS ───────────────────────────────────────────
function calcPerfConstraints() {
  const perfEl = document.getElementById('perf-panel')
  const headerEl = perfEl ? perfEl.querySelector('.panel-header') : null
  const headerH = headerEl ? headerEl.offsetHeight : 29
  const panelW = perfEl ? perfEl.clientWidth : (window.innerWidth - 180)
  const count = 8
  const gap = 5
  const padH = 20
  const padV = 10

  const boxW = Math.max(50, (panelW - padH - (count - 1) * gap) / count)
  const minH = Math.round(headerH + padV + boxW / 5)
  const maxH = Math.round(headerH + padV + boxW)

  return { minH, maxH, boxW, headerH, padV }
}

function applyPerfMinHeight() {
  const { minH } = calcPerfConstraints()
  const perfEl = document.getElementById('perf-panel')
  if (perfEl) perfEl.style.minHeight = minH + 'px'
}

// ── SNAP-BACK bei Gutter-Release ──────────────────────────
function snapPerfAfterDrag() {
  if (clampingPerf || !vertSplit) return
  const perfEl = document.getElementById('perf-panel')
  const container = document.getElementById('page-backtest')
  if (!perfEl || !container) return

  const { minH, maxH } = calcPerfConstraints()
  const perfH = perfEl.clientHeight
  const usable = container.clientHeight - 5

  let targetH = null
  if (perfH <= minH) targetH = minH + 4
  if (perfH > maxH) targetH = maxH

  if (targetH !== null) {
    clampingPerf = true
    const pct = Math.max(1, Math.min(99, (targetH / usable) * 100))
    vertSplit.setSizes([pct, 100 - pct])
    setTimeout(() => {
      clampingPerf = false
      resizePerf()
      resizeAllCharts()
    }, 60)
  }
}

// ── CHARTS RESIZE ─────────────────────────────────────────
function resizeAllCharts() {
  const container = document.getElementById('lwc-chart')
  if (lwChart && container) {
    const w = container.clientWidth
    const h = container.clientHeight
    if (w > 0 && h > 0) lwChart.resize(w, h)
  }
  const e = document.getElementById('plotly-equity')
  if (e && e.data) Plotly.Plots.resize(e)
}

// ── PERFORMANCE RESIZE ────────────────────────────────────
function resizePerf() {
  const perfEl = document.getElementById('perf-panel')
  const metricsEl = document.getElementById('perf-metrics')
  if (!perfEl || !metricsEl) return
  const boxes = metricsEl.querySelectorAll('.perf-metric-inline')
  if (!boxes.length) return

  const { boxW, headerH, padV } = calcPerfConstraints()
  const availH = perfEl.clientHeight - headerH - padV
  const boxH = Math.max(20, Math.min(availH, boxW))

  boxes.forEach(el => {
    el.style.width = boxW + 'px'
    el.style.height = boxH + 'px'
  })

  const valSize = Math.max(10, Math.min(36, boxH * 0.34))
  const subSize = Math.max(7, Math.min(16, boxH * 0.17))
  const labelSize = Math.max(6, Math.min(12, boxH * 0.13))

  document.querySelectorAll('.perf-metric-inline .value:not(.sub)').forEach(el => {
    el.style.fontSize = valSize + 'px'
  })
  document.querySelectorAll('.perf-metric-inline .value.sub').forEach(el => {
    el.style.fontSize = subSize + 'px'
  })
  document.querySelectorAll('.perf-metric-inline .label').forEach(el => {
    el.style.fontSize = labelSize + 'px'
  })
}

// ── LEGENDE ───────────────────────────────────────────────
function renderLegend(containerId, items) {
  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = items.map(({ name, color, dash, fill }) => {
    let swatch
    if (fill) {
      swatch = `<span style="display:inline-block;width:14px;height:10px;background:${fill};border:1.5px solid ${color};border-radius:2px;flex-shrink:0;"></span>`
    } else if (dash) {
      swatch = `<span style="display:inline-block;width:20px;height:2px;background:repeating-linear-gradient(90deg,${color} 0,${color} 4px,transparent 4px,transparent 8px);flex-shrink:0;"></span>`
    } else {
      swatch = `<span style="display:inline-block;width:20px;height:2px;background:${color};border-radius:1px;flex-shrink:0;"></span>`
    }
    return `<span class="legend-item">${swatch}<span>${name}</span></span>`
  }).join('')
}

// ── RESIZE OBSERVERS ──────────────────────────────────────
function initChartResizeObserver() {
  const obs = new ResizeObserver(() => {
    resizeAllCharts()
    if (lastEquityData) {
      clearTimeout(equityResizeTimer)
      equityResizeTimer = setTimeout(() => renderEquity(lastEquityData), 60)
    }
  })
  const cp = document.getElementById('chart-panel')
  const ep = document.getElementById('equity-panel')
  if (cp) obs.observe(cp)
  if (ep) obs.observe(ep)
}

function initPerfResizeObserver() {
  const perfEl = document.getElementById('perf-panel')
  if (!perfEl) return
  const obs = new ResizeObserver(() => {
    resizePerf()
    applyPerfMinHeight()
  })
  obs.observe(perfEl)
}

// ── LIGHTWEIGHT CHARTS INIT (lazy, idempotent) ────────────
function ensureLwcChart() {
  const container = document.getElementById('lwc-chart')
  if (!container) return false
  if (lwChart && lwCandleSeries) return true

  if (lwChart) {
    try { lwChart.remove() } catch (_) { }
    lwChart = null
    lwCandleSeries = null
    lwIndicatorSeries = []
  }

  container.innerHTML = ''

  lwChart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 600,
    height: container.clientHeight || 300,
    layout: {
      background: { color: '#0f0f1a' },
      textColor: '#6c7086',
    },
    watermark: {
      visible: false,
    },
    grid: {
      vertLines: { color: '#1a1a2e' },
      horzLines: { color: '#1a1a2e' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#1a1a2e',
    },
    timeScale: {
      borderColor: '#1a1a2e',
      timeVisible: true,
      secondsVisible: false,
      barSpacing: 8,
      minBarSpacing: 2,
      fixLeftEdge: true,
      fixRightEdge: true,
      rightOffset: 12,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  })

  lwCandleSeries = lwChart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  })

  setTimeout(() => {
    const watermarks = container.querySelectorAll('a')
    watermarks.forEach(el => el.remove())
    container.querySelectorAll('div').forEach(el => {
      const style = window.getComputedStyle(el)
      if (style.position === 'absolute' &&
        (style.zIndex === '1' || style.zIndex === '2')) {
        if (el.textContent.length < 50) el.remove()
      }
    })
  }, 100)

  return true
}

// ── INIT ──────────────────────────────────────────────────
function initBacktest(modules) {
  const stratSelect = document.getElementById('ctrl-strategy')
  if (!stratSelect) {
    console.error('[QuantOS] ctrl-strategy nicht im DOM – index.html prüfen!')
    return
  }
  stratSelect.innerHTML = ''
  modules.strategies.forEach(s => {
    const opt = document.createElement('option')
    opt.value = s; opt.textContent = s
    stratSelect.appendChild(opt)
  })

  const indSelect = document.getElementById('ctrl-indicator')
  if (!indSelect) {
    console.error('[QuantOS] ctrl-indicator nicht im DOM!')
    return
  }
  indSelect.innerHTML = ''
  modules.indicators.forEach(i => {
    const opt = document.createElement('option')
    opt.value = i; opt.textContent = i.toUpperCase()
    indSelect.appendChild(opt)
  })

  document.getElementById('btn-add-indicator').addEventListener('click', () => {
    const val = indSelect.value
    if (val && !activeIndicators.includes(val)) {
      activeIndicators.push(val)
      renderIndicatorTags()
      _cacheSaveParams()
    }
  })

  document.getElementById('btn-run').addEventListener('click', runBacktest)

  _cacheRestoreParams()

    ;['ctrl-symbol', 'ctrl-interval', 'ctrl-start', 'ctrl-end',
      'ctrl-capital', 'ctrl-sma', 'ctrl-strategy'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.addEventListener('change', _cacheSaveParams)
      })

  initSplitPanels()
  initEmptyCharts()
  initChartResizeObserver()
  initPerfResizeObserver()
}

function renderIndicatorTags() {
  const container = document.getElementById('active-indicators')
  container.innerHTML = ''
  activeIndicators.forEach(name => {
    const tag = document.createElement('div')
    tag.className = 'indicator-tag'
    tag.innerHTML = `<span>${name.toUpperCase()}</span><span class="remove-btn" data-name="${name}">✕</span>`
    tag.querySelector('.remove-btn').addEventListener('click', () => {
      activeIndicators = activeIndicators.filter(i => i !== name)
      renderIndicatorTags()
      _cacheSaveParams()
    })
    container.appendChild(tag)
  })
}

function initSplitPanels() {
  if (splitInitialized) return

  applyPerfMinHeight()
  const { minH } = calcPerfConstraints()

  var cached = _cacheLoad()
  var ly = (cached && cached.layout) ? cached.layout : {}

  const onDrag = () => {
    resizeAllCharts()
    resizePerf()
  }

  vertSplit = Split(['#perf-panel', '#backtest-body'], {
    sizes: [ly.perfSize || 15, ly.bodySize || 85],
    minSize: [minH, 300],
    gutterSize: 5,
    direction: 'vertical',
    onDrag,
    onDragEnd: (sizes) => {
      snapPerfAfterDrag()
      resizeAllCharts()
      resizePerf()

      setTimeout(() => {
        try {
          if (typeof QuantCache !== 'undefined' && vertSplit) {
            const finalSizes = vertSplit.getSizes()
            QuantCache.saveLayout({
              perfSize: finalSizes[0],
              bodySize: finalSizes[1]
            })
          }
        } catch (e) { }
      }, 100)
    }
  })

  Split(['#panels-container', '#controls-panel'], {
    sizes: [ly.panelsSize || 78, ly.controlsSize || 22],
    minSize: [400, 140],
    gutterSize: 5,
    direction: 'horizontal',
    onDrag: resizeAllCharts,
    onDragEnd: (sizes) => {
      resizeAllCharts()
      try {
        if (typeof QuantCache !== 'undefined') {
          QuantCache.saveLayout({
            panelsSize: sizes[0],
            controlsSize: sizes[1]
          })
        }
      } catch (e) { }
    }
  })

  Split(['#chart-panel', '#equity-panel'], {
    sizes: [ly.chartSize || 65, ly.equitySize || 35],
    minSize: [150, 100],
    gutterSize: 5,
    direction: 'vertical',
    onDrag: resizeAllCharts,
    onDragEnd: (sizes) => {
      resizeAllCharts()
      try {
        if (typeof QuantCache !== 'undefined') {
          QuantCache.saveLayout({
            chartSize: sizes[0],
            equitySize: sizes[1]
          })
        }
      } catch (e) { }
    }
  })

  splitInitialized = true
  window.addEventListener('resize', () => {
    applyPerfMinHeight()
    resizeAllCharts()
    resizePerf()
  })
}

function initEmptyCharts() {
  ensureLwcChart()

  Plotly.newPlot('plotly-equity', [], {
    paper_bgcolor: '#0f0f1a', plot_bgcolor: '#0f0f1a',
    font: { color: '#6c7086', size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    dragmode: 'zoom',
    showlegend: false,
    xaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e' },
    yaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e' }
  }, {
    responsive: true,
    scrollZoom: true,
    doubleClick: 'reset',
  })

  setTimeout(resizeAllCharts, 200)
}

// ── BACKTEST ──────────────────────────────────────────────
async function runBacktest() {
  const btn = document.getElementById('btn-run')
  btn.disabled = true
  btn.textContent = '⏳ Lädt...'

  _cacheSaveParams()

  // ── CHECK: API-Keys vorhanden? ────────────────────────
  const cached = _cacheLoad()
  const apiKeys = (cached && cached.api) ? cached.api : { alpacaKey: '', alpacaSecret: '' }

  if (!apiKeys.alpacaKey || !apiKeys.alpacaSecret) {
    document.getElementById('perf-metrics').innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 12px;
      text-align: center;
      overflow: hidden;
    ">
      <div style="font-size: clamp(24px, 8vw, 48px); margin-bottom: 8px;">🔐</div>
      <div style="
        color: #ef5350;
        font-size: clamp(10px, 2vw, 14px);
        font-weight: 600;
        margin-bottom: 6px;
        line-height: 1.3;
      ">
        Keine API-Keys
      </div>
      <div style="
        color: #6c7086;
        font-size: clamp(8px, 1.5vw, 12px);
        margin-bottom: 10px;
        line-height: 1.4;
        max-width: 90%;
      ">
        Bitte Keys in Data & Synchro eintragen
      </div>
      <button onclick="navigateTo('synchro')" style="
        background: #7aa2f7;
        color: #0a0a14;
        border: none;
        padding: clamp(6px, 1.5vw, 10px) clamp(12px, 3vw, 20px);
        border-radius: 6px;
        font-size: clamp(9px, 1.8vw, 13px);
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      ">
        Zu Data & Synchro →
      </button>
    </div>
  `
    btn.disabled = false
    btn.textContent = '▶ Backtest starten'
    return
  }


  const params = {
    symbol: document.getElementById('ctrl-symbol').value,
    interval: document.getElementById('ctrl-interval').value,
    start: document.getElementById('ctrl-start').value,
    end: document.getElementById('ctrl-end').value,
    capital: parseFloat(document.getElementById('ctrl-capital').value),
    sma_period: parseInt(document.getElementById('ctrl-sma').value) || 20,
    strategy: document.getElementById('ctrl-strategy').value,
    active_indicators: activeIndicators,
    alpaca_key: apiKeys.alpacaKey,
    alpaca_secret: apiKeys.alpacaSecret
  }

  try {
    const result = await apiBacktest(params)
    renderChart(result.chart)
    renderEquity(result.equity)
    renderPerformance(result.performance)
  } catch (err) {
    let errorMsg = err.message
    let hint = ''

    if (err.message.includes('401') || err.message.includes('API-Keys')) {
      hint = '<div style="margin-top:8px;"><button onclick="navigateTo(\'synchro\')" style="background:#7aa2f7;color:#0a0a14;border:none;padding:8px 16px;border-radius:4px;font-size:12px;cursor:pointer;">API-Keys eintragen →</button></div>'
    }

    document.getElementById('perf-metrics').innerHTML =
      `<div style="padding:12px;">
        <span style="color:#ef5350;font-size:12px;">❌ ${errorMsg}</span>
        ${hint}
      </div>`
  }

  btn.disabled = false
  btn.textContent = '▶ Backtest starten'
}

// ── RENDER CHART (Lightweight Charts) ────────────────────
function renderChart(data) {
  if (!ensureLwcChart()) {
    console.error('lwc-chart Container nicht gefunden')
    return
  }

  lwIndicatorSeries.forEach(s => lwChart.removeSeries(s))
  lwIndicatorSeries = []

  const candles = data.dates
    .map((d, i) => ({
      time: toUnixTime(d),
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
    }))
    .filter(c => c.open !== null && c.high !== null && c.low !== null && c.close !== null)

  lwCandleSeries.setData(candles)
  lwChart.timeScale().fitContent()

  setTimeout(() => {
    lwChart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
    })
  }, 50)

  const colors = ['#f7a233', '#7aa2f7', '#f38ba8', '#e0c060']
  const legendItems = [
    { name: 'Kerze ▲', color: '#26a69a' },
    { name: 'Kerze ▼', color: '#ef5350' }
  ]

  Object.entries(data.indicators).forEach(([col, values], i) => {
    const color = colors[i % colors.length]
    const series = lwChart.addLineSeries({
      color,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const lineData = data.dates
      .map((d, idx) => ({ time: toUnixTime(d), value: values[idx] }))
      .filter(p => p.value !== null)

    series.setData(lineData)
    lwIndicatorSeries.push(series)
    legendItems.push({ name: col.toUpperCase(), color })
  })

  renderLegend('legend-chart', legendItems)
  setTimeout(resizeAllCharts, 100)
}

// ── RENDER EQUITY (Plotly) ────────────────────────────────
function renderEquity(data) {
  lastEquityData = data

  const lastDate = data.dates[data.dates.length - 1]
  const lastEquity = data.equity[data.equity.length - 1]

  const anchorY = [
    ...data.equity.filter(v => v !== null),
    ...data.bh_equity.filter(v => v !== null),
    ...data.equity_high.filter(v => v !== null),
    ...data.equity_low.filter(v => v !== null),
  ]
  const yDataMin = anchorY.reduce((a, b) => Math.min(a, b))
  const yDataMax = anchorY.reduce((a, b) => Math.max(a, b))
  const dataRange = yDataMax - yDataMin
  const yBuffer = dataRange * 0.1

  const yMin = yDataMin - yBuffer
  const yMax = yDataMax + yBuffer

  const capProj = v => v === null ? null : Math.min(Math.max(v, yMin), yMax)
  const cappedUpper = data.projection.upper.map(capProj)
  const cappedLower = data.projection.lower.map(capProj)
  const cappedMid = data.projection.mid.map(capProj)

  const xMin = data.dates[0]
  const xMax = data.projection.dates.length > 0
    ? data.projection.dates[data.projection.dates.length - 1]
    : lastDate

  const xMinMs = new Date(xMin).getTime()
  const xMaxMs = new Date(xMax).getTime()

  const traces = [
    {
      name: 'Potential Equity High',
      type: 'scatter', x: data.dates, y: data.equity_high,
      line: { color: 'rgba(255,210,50,0.7)', width: 1 },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Potential Equity Low',
      type: 'scatter', x: data.dates, y: data.equity_low,
      fill: 'tonexty', fillcolor: 'rgba(255,210,50,0.15)',
      line: { color: 'rgba(255,210,50,0.7)', width: 1 },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Buy & Hold',
      type: 'scatter', x: data.dates, y: data.bh_equity,
      line: { color: '#6c7086', width: 1.5, dash: 'dot' },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Equity',
      type: 'scatter', x: data.dates, y: data.equity,
      line: { color: '#26a69a', width: 2 },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Projection Upper',
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...cappedUpper],
      line: { color: 'rgba(122,162,247,0.2)', width: 1 },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Projection Lower',
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...cappedLower],
      fill: 'tonexty', fillcolor: 'rgba(122,162,247,0.1)',
      line: { color: 'rgba(122,162,247,0.25)', width: 1 },
      showlegend: false, hoverinfo: 'x+y+name'
    },
    {
      name: 'Erwartete Equity',
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...cappedMid],
      line: { color: '#7aa2f7', width: 1.5, dash: 'dot' },
      showlegend: false, hoverinfo: 'x+y+name'
    }
  ]

  Plotly.react('plotly-equity', traces, {
    paper_bgcolor: '#0f0f1a',
    plot_bgcolor: '#0f0f1a',
    font: { color: '#6c7086', size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    dragmode: 'pan',
    showlegend: false,
    xaxis: {
      gridcolor: '#1a1a2e',
      zerolinecolor: '#1a1a2e',
      range: [xMin, xMax],
    },
    yaxis: {
      gridcolor: '#1a1a2e',
      zerolinecolor: '#1a1a2e',
      range: [yMin, yMax],
    },
    shapes: [{
      type: 'line', x0: lastDate, x1: lastDate, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: '#3a3a5e', width: 1, dash: 'dot' }
    }]
  }, {
    responsive: true,
    scrollZoom: true,
    doubleClick: false,
    modeBarButtonsToRemove: ['zoom2d', 'autoScale2d'],
    displaylogo: false
  })

  const plotEl = document.getElementById('plotly-equity')
  plotEl.removeAllListeners && plotEl.removeAllListeners('plotly_relayout')

  plotEl.on('plotly_relayout', (eventData) => {
    if (equityRelayoutGuard) return

    const hasX = eventData['xaxis.range[0]'] !== undefined
    const hasY = eventData['yaxis.range[0]'] !== undefined
    if (!hasX && !hasY) return

    let needsSnap = false
    const updates = {}

    if (hasX) {
      let curMin = new Date(eventData['xaxis.range[0]']).getTime()
      let curMax = new Date(eventData['xaxis.range[1]']).getTime()
      const timeWidth = curMax - curMin

      if (curMin < xMinMs) { curMin = xMinMs; curMax = curMin + timeWidth; needsSnap = true }
      if (curMax > xMaxMs) { curMax = xMaxMs; curMin = curMax - timeWidth; needsSnap = true }
      if (curMin < xMinMs) curMin = xMinMs
      if (curMax > xMaxMs) curMax = xMaxMs

      if (needsSnap) {
        updates['xaxis.range[0]'] = new Date(curMin).toISOString()
        updates['xaxis.range[1]'] = new Date(curMax).toISOString()
      }
    }

    if (hasY) {
      let curYMin = parseFloat(eventData['yaxis.range[0]'])
      let curYMax = parseFloat(eventData['yaxis.range[1]'])
      const yHeight = curYMax - curYMin

      if (curYMin < yMin) { curYMin = yMin; curYMax = curYMin + yHeight; needsSnap = true }
      if (curYMax > yMax) { curYMax = yMax; curYMin = curYMax - yHeight; needsSnap = true }
      if (curYMin < yMin) curYMin = yMin
      if (curYMax > yMax) curYMax = yMax

      if (needsSnap) {
        updates['yaxis.range[0]'] = curYMin
        updates['yaxis.range[1]'] = curYMax
      }
    }

    if (needsSnap && Object.keys(updates).length > 0) {
      equityRelayoutGuard = true
      Plotly.relayout(plotEl, updates).then(() => { equityRelayoutGuard = false })
    }
  })

  renderLegend('legend-equity', [
    { name: 'Potential Equity', color: 'rgba(255,210,50,0.8)', fill: 'rgba(255,210,50,0.15)' },
    { name: 'Buy & Hold', color: '#6c7086', dash: true },
    { name: 'Equity', color: '#26a69a' },
    { name: 'Projection Zone', color: 'rgba(122,162,247,0.6)', fill: 'rgba(122,162,247,0.1)' },
    { name: 'Erwartete Equity', color: '#7aa2f7', dash: true }
  ])

  setTimeout(resizeAllCharts, 100)
}

// ── RENDER PERFORMANCE ────────────────────────────────────
function renderPerformance(p) {
  const totSign = p.total_return >= 0 ? '+' : ''
  const bhSign = p.bh_return >= 0 ? '+' : ''
  const totClass = p.total_return >= 0 ? 'positive' : 'negative'
  const bhClass = p.bh_return >= 0 ? 'positive' : 'negative'
  const pfClass = p.profit_factor >= 1 ? 'positive' : 'negative'
  const caClass = p.calmar >= 0 ? 'positive' : 'negative'

  document.getElementById('perf-metrics').innerHTML = `
    <div class="perf-metric-inline">
      <span class="label">ENDKAPITAL</span>
      <span class="value ${totClass}">€${p.end_capital.toLocaleString('de-DE')}</span>
      <span class="value sub ${totClass}">${totSign}${p.total_return}%</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">BUY & HOLD</span>
      <span class="value ${bhClass}">€${p.bh_capital.toLocaleString('de-DE')}</span>
      <span class="value sub ${bhClass}">${bhSign}${p.bh_return}%</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">SHARPE</span>
      <span class="value">${p.sharpe}</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">MAX DRAWDOWN</span>
      <span class="value negative">${p.max_drawdown}%</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">WIN RATE</span>
      <span class="value">${p.win_rate}%</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">TRADES</span>
      <span class="value">${p.total_trades}</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">PROFIT FACTOR</span>
      <span class="value ${pfClass}">${p.profit_factor}</span>
    </div>
    <div class="perf-metric-inline">
      <span class="label">CALMAR</span>
      <span class="value ${caClass}">${p.calmar}</span>
    </div>
  `

  setTimeout(resizePerf, 0)
  setTimeout(resizeAllCharts, 100)
}