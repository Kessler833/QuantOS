export function navigateTo(page) {
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

  // Page-spezifische Callbacks
  const event = new CustomEvent('page-activated', { detail: { page } })
  document.dispatchEvent(event)
}

// Global verfügbar machen
window.navigateTo = navigateTo
