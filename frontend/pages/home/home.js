function initHome() {
  _checkApiKeysOnHome()
}

function _checkApiKeysOnHome() {
  const warning = document.getElementById('home-api-warning')
  if (!warning) return

  const cached  = QuantCache.load()
  const apiKeys = (cached && cached.api) ? cached.api : {}

  if (!apiKeys.alpacaKey || !apiKeys.alpacaSecret) {
    warning.innerHTML = `
      <div class="api-key-warning">
        <div style="font-size:36px;margin-bottom:8px;">🔐</div>
        <div style="color:#ef5350;font-size:15px;font-weight:700;margin-bottom:6px;">
          Keine API-Keys konfiguriert
        </div>
        <div style="color:#a0a0b8;font-size:12px;margin-bottom:12px;line-height:1.4;">
          Trage deine Alpaca API-Keys ein um Backtests durchzuführen
        </div>
        <button onclick="navigateTo('synchro')" class="btn-primary">
          Zu Data & Synchro →
        </button>
      </div>`
  } else {
    warning.innerHTML = ''
  }
}
