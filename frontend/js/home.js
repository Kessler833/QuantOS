function initHome() {
  const container = document.getElementById('module-cards')
  
  const cards = [
    {
      icon: '📊',
      title: 'Backtest',
      desc: 'Teste deine Strategien mit historischen Daten',
      page: 'backtest'
    },
    {
      icon: '🔗',
      title: 'Markov',
      desc: 'Markov-Chain Analyse für Wahrscheinlichkeiten',
      page: 'markov'
    },
    {
      icon: '⚙️',
      title: 'Optimizer',
      desc: 'Automatische Parameter-Optimierung',
      page: 'optimizer'
    },
    {
      icon: '🔐',
      title: 'Data & Synchro',
      desc: 'API-Konfiguration und Cache-Verwaltung',
      page: 'synchro'
    }
  ]

  cards.forEach(c => {
    const card = document.createElement('div')
    card.className = 'module-card'
    card.innerHTML = `
      <div class="card-icon">${c.icon}</div>
      <div class="card-title">${c.title}</div>
      <div class="card-desc">${c.desc}</div>
    `
    card.addEventListener('click', () => navigateTo(c.page))
    container.appendChild(card)
  })
}
