// ══════════════════════════════════════════════
//  Home Page – Landing & Navigation
// ══════════════════════════════════════════════

function initHome() {
  console.log('[Home] Init started')
  
  let container = document.querySelector('#page-home .content')
  
  if (!container) {
    console.log('[Home] .content not found, trying #page-home directly')
    container = document.getElementById('page-home')
  }
  
  if (!container) {
    console.error('[Home] No valid container found!')
    return
  }
  
  console.log('[Home] Container found:', container.id || container.className)
  
  _ensureHomeStructure(container)
  _checkApiKeysOnHome(container)
  console.log('[Home] Init completed')
}

function _ensureHomeStructure(container) {
  let cardsContainer = container.querySelector('.home-cards')
  
  if (!cardsContainer) {
    console.log('[Home] Creating home cards...')
    cardsContainer = document.createElement('div')
    cardsContainer.className = 'home-cards'
    cardsContainer.innerHTML = `
      <div class="home-card" onclick="navigateTo('backtest')">
        <div class="home-card-icon">📊</div>
        <div class="home-card-title">Backtest</div>
        <div class="home-card-desc">Teste deine Trading-Strategien</div>
      </div>
      
      <div class="home-card" onclick="navigateTo('synchro')">
        <div class="home-card-icon">🔐</div>
        <div class="home-card-title">Data & Synchro</div>
        <div class="home-card-desc">API-Keys & Cache verwalten</div>
      </div>
      
      <div class="home-card" onclick="navigateTo('markov')">
        <div class="home-card-icon">🎲</div>
        <div class="home-card-title">Markov Chain</div>
        <div class="home-card-desc">Stochastische Marktanalyse</div>
      </div>
      
      <div class="home-card" onclick="navigateTo('optimizer')">
        <div class="home-card-icon">⚙️</div>
        <div class="home-card-title">Optimizer</div>
        <div class="home-card-desc">Parameter-Optimierung</div>
      </div>
    `
    container.appendChild(cardsContainer)
    console.log('[Home] Cards created successfully')
  } else {
    console.log('[Home] Cards already exist')
  }
}

function _checkApiKeysOnHome(container) {
  try {
    const cached = QuantCache.load()
    const apiKeys = (cached && cached.api) ? cached.api : { alpacaKey: '', alpacaSecret: '' }
    
    console.log('[Home] API Keys check:', {
      hasKey: !!apiKeys.alpacaKey,
      hasSecret: !!apiKeys.alpacaSecret
    })
    
    const oldWarning = container.querySelector('.api-key-warning')
    if (oldWarning) {
      console.log('[Home] Removing old warning')
      oldWarning.remove()
    }
    
    if (!apiKeys.alpacaKey || !apiKeys.alpacaSecret) {
      console.log('[Home] Creating API key warning')
      const warning = document.createElement('div')
      warning.className = 'api-key-warning'
      warning.innerHTML = `
        <div>
          <div style="font-size: 36px; margin-bottom: 8px;">🔐</div>
          <div style="color: #ef5350; font-size: 15px; font-weight: 700; margin-bottom: 6px;">
            Keine API-Keys konfiguriert
          </div>
          <div style="color: #a0a0b8; font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
            Trage deine Alpaca API-Keys ein um Backtests durchzuführen
          </div>
          <button onclick="navigateTo('synchro')" style="
            background: #7aa2f7;
            color: #0a0a14;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='translateY(-2px)'" 
             onmouseout="this.style.transform='translateY(0)'">
            Zu Data & Synchro →
          </button>
        </div>
      `
      const cardsContainer = container.querySelector('.home-cards')
      if (cardsContainer) {
        container.insertBefore(warning, cardsContainer)
        console.log('[Home] Warning inserted before cards')
      } else {
        container.insertBefore(warning, container.firstChild)
        console.log('[Home] Warning inserted at top')
      }
    } else {
      console.log('[Home] API keys present, no warning needed')
    }
  } catch (e) {
    console.error('[Home] API-Key Check failed:', e)
  }
}
