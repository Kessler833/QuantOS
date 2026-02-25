async function init() {
  let modules = { strategies: [], indicators: [] }
  try {
    modules = await apiModules()
  } catch (e) {
    console.warn('[App] Backend nicht erreichbar:', e)
  }

  await _injectPageHTML('page-home',    './pages/home/home.html')
  await _injectPageHTML('page-market',  './pages/market/market.html')
  await _injectPageHTML('page-synchro', './pages/synchro/synchro.html')

  try { initHome() }            catch (e) { console.warn('[Init] home:', e) }
  try { initBacktest(modules) } catch (e) { console.warn('[Init] backtest:', e) }
  try { initMarket() }          catch (e) { console.warn('[Init] market:', e) }
  try { initSynchro() }         catch (e) { console.warn('[Init] synchro:', e) }

  // Diese zwei Blöcke laufen jetzt IMMER, egal was crasht:
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page))
  })

  document.addEventListener('page-activated', (e) => {
    const page = e.detail.page
    if (page === 'home')     try { initHome() }          catch(_) {}
    if (page === 'market')   try { onMarketActivated() } catch(_) {}
    if (page === 'backtest') setTimeout(resizeAllCharts, 100)
  })

  setTimeout(resizeAllCharts, 300)
}

async function _injectPageHTML(containerId, path) {
  try {
    const r    = await fetch(path)
    const html = await r.text()
    const el   = document.getElementById(containerId)
    if (el) el.innerHTML = html
  } catch (e) {
    console.warn(`[App] HTML inject fehlgeschlagen für ${path}:`, e)
  }
}

init()
