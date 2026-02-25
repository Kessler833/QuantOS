// ── SYNCHRO PAGE ─────────────────────────────────────────
function initSynchro() {
  const container = document.getElementById('page-synchro')
  if (!container) return

  if (!container.querySelector('.synchro-container')) return

  const cached  = QuantCache.load()
  const apiKeys = (cached && cached.api) ? cached.api : {}

  const keyInput    = document.getElementById('input-alpaca-key')
  const secretInput = document.getElementById('input-alpaca-secret')
  const statusBadge = document.getElementById('api-key-status')
  const notif       = document.getElementById('synchro-notification')

  if (keyInput    && apiKeys.alpacaKey)    keyInput.value    = apiKeys.alpacaKey
  if (secretInput && apiKeys.alpacaSecret) secretInput.value = apiKeys.alpacaSecret

  _updateStatusBadge(statusBadge, !!apiKeys.alpacaKey)

  // ── Save API Keys ──────────────────────────────────────
  document.getElementById('btn-save-api')?.addEventListener('click', async () => {
    const key    = keyInput?.value.trim()
    const secret = secretInput?.value.trim()

    if (!key || !secret) {
      _showNotif(notif, '<span style="color:#ffa726;">⚠</span> Bitte beide Felder ausfüllen.', 'warn')
      return
    }

    _showNotif(notif, '⏳ Validiere API-Keys…', 'info')

    try {
      const result = await apiHealth({ alpaca_key: key, alpaca_secret: secret })
      if (result.alpaca_valid) {
        QuantCache.saveApi({ alpacaKey: key, alpacaSecret: secret })
        _updateStatusBadge(statusBadge, true)
        _showNotif(notif, '✅ API-Keys gespeichert & validiert!', 'success')
      } else {
        _showNotif(notif, '❌ Ungültige API-Keys – nicht gespeichert.', 'error')
      }
    } catch (e) {
      _showNotif(notif, `❌ Fehler: ${e.message}`, 'error')
    }
  })

  // ── Partial Reset ─────────────────────────────────────
  document.getElementById('btn-reset-partial')?.addEventListener('click', () => {
    QuantCache.resetPartial()
    _showNotif(notif, '🔄 Partial Reset durchgeführt. API-Keys bleiben erhalten.', 'success')
  })

  // ── Full Reset ────────────────────────────────────────
  document.getElementById('btn-reset-full')?.addEventListener('click', () => {
    if (!confirm('Wirklich ALLE Daten löschen inkl. API-Keys?')) return
    QuantCache.resetFull()
    if (keyInput)    keyInput.value    = ''
    if (secretInput) secretInput.value = ''
    _updateStatusBadge(statusBadge, false)
    if (notif) {
      notif.innerHTML = '<span style="color:#26a69a;">✓</span> Full Reset durchgeführt.'
      setTimeout(() => { notif.innerHTML = '' }, 4000)
    }
  })
}

function _updateStatusBadge(el, valid) {
  if (!el) return
  el.innerHTML = valid
    ? '<span style="color:#26a69a;">✓</span> <span style="color:#26a69a;">API-Keys konfiguriert</span>'
    : '<span style="color:#ffa726;">⚠</span> <span style="color:#ef5350;">Keine API-Keys</span>'
}

function _showNotif(el, msg, type) {
  if (!el) return
  const colors = { success: '#26a69a', error: '#ef5350', warn: '#ffa726', info: '#7aa2f7' }
  el.style.color = colors[type] || '#cdd6f4'
  el.innerHTML = msg
  if (type === 'success') setTimeout(() => { el.innerHTML = '' }, 4000)
}
