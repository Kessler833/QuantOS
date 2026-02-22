let activeIndicators  = []
let splitInitialized  = false
let lastEquityData    = null
let equityResizeTimer = null
let vertSplit         = null
let clampingPerf      = false

// ── CONSTRAINTS ───────────────────────────────────────────
function calcPerfConstraints() {
  const perfEl   = document.getElementById('perf-panel')
  const headerEl = perfEl ? perfEl.querySelector('.panel-header') : null
  const headerH  = headerEl ? headerEl.offsetHeight : 29
  const panelW   = perfEl  ? perfEl.clientWidth     : (window.innerWidth - 180)
  const count    = 8
  const gap      = 5
  const padH     = 20
  const padV     = 10

  const boxW = Math.max(50, (panelW - padH - (count - 1) * gap) / count)
  const minH = Math.round(headerH + padV + boxW / 4)
  const maxH = Math.round(headerH + padV + boxW)

  return { minH, maxH, boxW, headerH, padV }
}

function applyPerfMinHeight() {
  const { minH } = calcPerfConstraints()
  const perfEl = document.getElementById('perf-panel')
  if (perfEl) perfEl.style.minHeight = minH + 'px'
}

// ── SNAP-BACK bei Gutter-Release ──────────────────────────
// Wenn am Minimum losgelassen → +4px Puffer → Gutter bleibt nutzbar
function snapPerfAfterDrag() {
  if (clampingPerf || !vertSplit) return
  const perfEl    = document.getElementById('perf-panel')
  const container = document.getElementById('page-backtest')
  if (!perfEl || !container) return

  const { minH, maxH } = calcPerfConstraints()
  const perfH   = perfEl.clientHeight
  const usable  = container.clientHeight - 5  // minus gutter

  let targetH = null
  if (perfH <= minH)  targetH = minH + 4   // ← Puffer verhindert Stuck-State
  if (perfH > maxH)   targetH = maxH

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

function enforceMaxPerf() {
  if (clampingPerf || !vertSplit) return
  const perfEl    = document.getElementById('perf-panel')
  const container = document.getElementById('page-backtest')
  if (!perfEl || !container) return
  const { maxH }  = calcPerfConstraints()
  if (perfEl.clientHeight <= maxH) return

  clampingPerf = true
  const usable = container.clientHeight - 5
  const pct    = Math.min(99, (maxH / usable) * 100)
  vertSplit.setSizes([pct, 100 - pct])
  setTimeout(() => { clampingPerf = false }, 80)
}

// ── CHARTS RESIZE ─────────────────────────────────────────
function resizeAllCharts() {
  const c = document.getElementById('plotly-chart')
  const e = document.getElementById('plotly-equity')
  if (c && c.data) Plotly.Plots.resize(c)
  if (e && e.data) Plotly.Plots.resize(e)
}

// ── PERFORMANCE RESIZE ────────────────────────────────────
function resizePerf() {
  const perfEl    = document.getElementById('perf-panel')
  const metricsEl = document.getElementById('perf-metrics')
  if (!perfEl || !metricsEl) return
  const boxes = metricsEl.querySelectorAll('.perf-metric-inline')
  if (!boxes.length) return

  const { boxW, headerH, padV } = calcPerfConstraints()
  const availH = perfEl.clientHeight - headerH - padV
  const boxH   = Math.max(20, Math.min(availH, boxW))

  boxes.forEach(el => {
    el.style.width  = boxW + 'px'
    el.style.height = boxH + 'px'
  })

  const valSize   = Math.max(10, Math.min(36, boxH * 0.34))
  const subSize   = Math.max(7,  Math.min(16, boxH * 0.17))
  const labelSize = Math.max(6,  Math.min(12, boxH * 0.13))

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

// ── RESIZE OBSERVERS ─────────────────────────────────────
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

// ── INIT ─────────────────────────────────────────────────
function initBacktest(modules) {
  const stratSelect = document.getElementById('ctrl-strategy')
  stratSelect.innerHTML = ''
  modules.strategies.forEach(s => {
    const opt = document.createElement('option')
    opt.value = s; opt.textContent = s
    stratSelect.appendChild(opt)
  })

  const indSelect = document.getElementById('ctrl-indicator')
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
    }
  })

  document.getElementById('btn-run').addEventListener('click', runBacktest)

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
    })
    container.appendChild(tag)
  })
}

function initSplitPanels() {
  if (splitInitialized) return

  applyPerfMinHeight()
  const { minH } = calcPerfConstraints()

  const onDrag = () => {
    enforceMaxPerf()
    resizeAllCharts()
    resizePerf()
  }

  const onDragEnd = () => {
    snapPerfAfterDrag()   // ← snap +4px wenn am Minimum losgelassen
    resizeAllCharts()
    resizePerf()
  }

  vertSplit = Split(['#perf-panel', '#backtest-body'], {
    sizes:      [15, 85],
    minSize:    [minH, 300],
    gutterSize: 5,
    direction:  'vertical',
    onDrag,
    onDragEnd
  })

  Split(['#panels-container', '#controls-panel'], {
    sizes: [78, 22], minSize: [400, 140], gutterSize: 5,
    direction:  'horizontal',
    onDrag:     resizeAllCharts,
    onDragEnd:  resizeAllCharts
  })

  Split(['#chart-panel', '#equity-panel'], {
    sizes: [65, 35], minSize: [150, 100], gutterSize: 5,
    direction:  'vertical',
    onDrag:     resizeAllCharts,
    onDragEnd:  resizeAllCharts
  })

  splitInitialized = true
  window.addEventListener('resize', () => {
    applyPerfMinHeight()
    resizeAllCharts()
    resizePerf()
  })
}

function initEmptyCharts() {
  const layout = {
    paper_bgcolor: '#0f0f1a', plot_bgcolor: '#0f0f1a',
    font: { color: '#6c7086', size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    showlegend: false,
    xaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e' },
    yaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e' }
  }
  Plotly.newPlot('plotly-chart',  [], layout, { responsive: true })
  Plotly.newPlot('plotly-equity', [], layout, { responsive: true })
  setTimeout(resizeAllCharts, 200)
}

// ── BACKTEST ─────────────────────────────────────────────
async function runBacktest() {
  const btn = document.getElementById('btn-run')
  btn.disabled = true
  btn.textContent = '⏳ Lädt...'

  const params = {
    symbol:            document.getElementById('ctrl-symbol').value,
    interval:          document.getElementById('ctrl-interval').value,
    start:             document.getElementById('ctrl-start').value,
    end:               document.getElementById('ctrl-end').value,
    capital:           parseFloat(document.getElementById('ctrl-capital').value),
    sma_period:        parseInt(document.getElementById('ctrl-sma').value) || 20,
    strategy:          document.getElementById('ctrl-strategy').value,
    active_indicators: activeIndicators
  }

  try {
    const result = await apiBacktest(params)
    renderChart(result.chart)
    renderEquity(result.equity)
    renderPerformance(result.performance)
  } catch (err) {
    document.getElementById('perf-metrics').innerHTML =
      `<span style="color:#ef5350;font-size:12px;padding:8px;">❌ ${err.message}</span>`
  }

  btn.disabled = false
  btn.textContent = '▶ Backtest starten'
}

// ── RENDER CHART ─────────────────────────────────────────
function renderChart(data) {
  const traces = [{
    type: 'candlestick',
    x: data.dates,
    open: data.open, high: data.high, low: data.low, close: data.close,
    increasing: { line: { color: '#26a69a' } },
    decreasing: { line: { color: '#ef5350' } },
    showlegend: false
  }]

  const colors = ['#f7a233', '#7aa2f7', '#f38ba8', '#e0c060']
  const legendItems = [
    { name: 'Kerze ▲', color: '#26a69a' },
    { name: 'Kerze ▼', color: '#ef5350' }
  ]

  Object.entries(data.indicators).forEach(([col, values], i) => {
    const color = colors[i % colors.length]
    traces.push({
      type: 'scatter', x: data.dates, y: values,
      line: { color, width: 1.5 }, showlegend: false
    })
    legendItems.push({ name: col.toUpperCase(), color })
  })

  Plotly.react('plotly-chart', traces, {
    paper_bgcolor: '#0f0f1a', plot_bgcolor: '#0f0f1a',
    font: { color: '#6c7086', size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    showlegend: false,
    xaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e', rangeslider: { visible: false } },
    yaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e', autorange: true }
  }, { responsive: true })

  renderLegend('legend-chart', legendItems)
  setTimeout(resizeAllCharts, 100)
}

// ── RENDER EQUITY ─────────────────────────────────────────
function renderEquity(data) {
  lastEquityData = data

  const lastDate   = data.dates[data.dates.length - 1]
  const lastEquity = data.equity[data.equity.length - 1]

  const allY = [
    ...data.equity.filter(v => v !== null),
    ...data.bh_equity.filter(v => v !== null),
    ...data.equity_high.filter(v => v !== null),
    ...data.equity_low.filter(v => v !== null)
  ]
  const minY      = Math.min(...allY)
  const maxY      = Math.max(...allY)
  const dataRange = maxY - minY

  const equityPanelEl = document.getElementById('equity-panel')
  const panelPx       = equityPanelEl ? Math.max(equityPanelEl.clientHeight, 50) : 300
  const buffer = Math.min((dataRange / panelPx) * 50, dataRange * 0.15)

  const traces = [
    {
      type: 'scatter', x: data.dates, y: data.equity_high,
      line: { color: 'rgba(255,210,50,0.7)', width: 1 },
      showlegend: false, hoverinfo: 'skip'
    },
    {
      type: 'scatter', x: data.dates, y: data.equity_low,
      fill: 'tonexty', fillcolor: 'rgba(255,210,50,0.15)',
      line: { color: 'rgba(255,210,50,0.7)', width: 1 },
      showlegend: false, hoverinfo: 'skip'
    },
    {
      type: 'scatter', x: data.dates, y: data.bh_equity,
      line: { color: '#6c7086', width: 1.5, dash: 'dot' }, showlegend: false
    },
    {
      type: 'scatter', x: data.dates, y: data.equity,
      line: { color: '#26a69a', width: 2 }, showlegend: false
    },
    {
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...data.projection.upper],
      line: { color: 'rgba(122,162,247,0.2)', width: 1 },
      showlegend: false, hoverinfo: 'skip'
    },
    {
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...data.projection.lower],
      fill: 'tonexty', fillcolor: 'rgba(122,162,247,0.1)',
      line: { color: 'rgba(122,162,247,0.25)', width: 1 },
      showlegend: false
    },
    {
      type: 'scatter',
      x: [lastDate, ...data.projection.dates],
      y: [lastEquity, ...data.projection.mid],
      line: { color: '#7aa2f7', width: 1.5, dash: 'dot' },
      showlegend: false
    }
  ]

  Plotly.react('plotly-equity', traces, {
    paper_bgcolor: '#0f0f1a', plot_bgcolor: '#0f0f1a',
    font: { color: '#6c7086', size: 11 },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    showlegend: false,
    xaxis: { gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e' },
    yaxis: {
      gridcolor: '#1a1a2e', zerolinecolor: '#1a1a2e',
      range: [minY - buffer, maxY + buffer]
    },
    shapes: [{
      type: 'line', x0: lastDate, x1: lastDate, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: '#3a3a5e', width: 1, dash: 'dot' }
    }]
  }, { responsive: true })

  renderLegend('legend-equity', [
    { name: 'Potential Equity', color: 'rgba(255,210,50,0.8)', fill: 'rgba(255,210,50,0.15)' },
    { name: 'Buy & Hold',       color: '#6c7086', dash: true },
    { name: 'Strategie',        color: '#26a69a' },
    { name: 'Projection Zone',  color: 'rgba(122,162,247,0.6)', fill: 'rgba(122,162,247,0.1)' },
    { name: 'Erwarteter Pfad',  color: '#7aa2f7', dash: true }
  ])

  setTimeout(resizeAllCharts, 100)
}

// ── RENDER PERFORMANCE ────────────────────────────────────
function renderPerformance(p) {
  const totSign  = p.total_return  >= 0 ? '+' : ''
  const bhSign   = p.bh_return    >= 0 ? '+' : ''
  const totClass = p.total_return  >= 0 ? 'positive' : 'negative'
  const bhClass  = p.bh_return    >= 0 ? 'positive' : 'negative'
  const pfClass  = p.profit_factor >= 1 ? 'positive' : 'negative'
  const caClass  = p.calmar       >= 0 ? 'positive' : 'negative'

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
