const MODULE_META = {
  backtest:  { icon: '📊', desc: 'Strategien auf historischen Daten testen und Performance-Metriken auswerten.' },
  markov:    { icon: '🔗', desc: 'Marktregime mit Hidden Markov Models erkennen.' },
  optimizer: { icon: '⚙️', desc: 'Parameter automatisch optimieren und beste Kombinationen finden.' }
}

function initHome() {
  const container = document.getElementById('module-cards')
  container.innerHTML = ''

  Object.entries(MODULE_META).forEach(([name, meta]) => {
    const card = document.createElement('div')
    card.className = 'module-card'
    card.innerHTML = `
      <div class="card-icon">${meta.icon}</div>
      <div class="card-title">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
      <div class="card-desc">${meta.desc}</div>
    `
    card.addEventListener('click', () => navigateTo(name))
    container.appendChild(card)
  })
}
