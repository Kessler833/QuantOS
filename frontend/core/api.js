const BASE = 'http://localhost:8000'

async function apiHealth(data) {
  const r = await fetch(`${BASE}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return r.json()
}

async function apiModules() {
  const r = await fetch(`${BASE}/api/modules`)
  return r.json()
}

async function apiBacktest(params) {
  const r = await fetch(`${BASE}/api/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!r.ok) {
    let detail = `Server Fehler (${r.status})`
    try { const err = await r.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  return r.json()
}

async function apiHeatmap(params) {
  const r = await fetch(`${BASE}/api/heatmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!r.ok) {
    let detail = `Server Fehler (${r.status})`
    try { const err = await r.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  return r.json()
}
