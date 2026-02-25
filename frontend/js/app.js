async function init() {
  const modules = await apiModules()

  // Pages initialisieren
  _injectPageHTML('page-home',    '/frontend/pages/home/home.html')
  _injectPageHTML('page-market',  '/frontend/pages/market/market.html')
  _injectPageHTML('page-synchro', '/frontend/pages/synchro/synchro.html')

  initHome()
  initBacktest(modules)
  initMarket()
  initSynchro()

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page))
  })

  // Page-activated Event listener
  document.addEventListener('page-activated', (e) => {
    const page = e.detail.page
    if (page === 'home')   initHome()
    if (page === 'market') onMarketActivated()
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
    console.warn(`[App] Could not inject ${path}:`, e)
  }
}

init()
async function init() {
  const modules = await apiModules()

  // Pages initialisieren
  _injectPageHTML('page-home',    '/frontend/pages/home/home.html')
  _injectPageHTML('page-market',  '/frontend/pages/market/market.html')
  _injectPageHTML('page-synchro', '/frontend/pages/synchro/synchro.html')

  initHome()
  initBacktest(modules)
  initMarket()
  initSynchro()

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page))
  })

  // Page-activated Event listener
  document.addEventListener('page-activated', (e) => {
    const page = e.detail.page
    if (page === 'home')   initHome()
    if (page === 'market') onMarketActivated()
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
    console.warn(`[App] Could not inject ${path}:`, e)
  }
}

init()
