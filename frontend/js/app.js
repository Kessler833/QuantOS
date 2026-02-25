async function init() {
  const modules = await apiModules()

  initHome()
  initBacktest(modules)
  initMarket()
  initSynchro()

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page))
  })

  setTimeout(resizeAllCharts, 300)
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))

  const pageEl = document.getElementById(`page-${page}`)
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`)

  if (pageEl) pageEl.classList.add('active')
  if (navEl)  navEl.classList.add('active')

  const sidebar = document.getElementById('sidebar')
  if (page === 'home') {
    sidebar.classList.remove('collapsed')
  } else {
    sidebar.classList.add('collapsed')
  }

  if (page === 'home')    setTimeout(() => initHome(), 50)
  if (page === 'market')  setTimeout(() => onMarketActivated(), 50)
  if (page === 'backtest') setTimeout(resizeAllCharts, 100)
}

init()
