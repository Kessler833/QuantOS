// ══════════════════════════════════════════════
//  Data & Synchro Page – API Keys & Cache Reset
// ══════════════════════════════════════════════

function initSynchro() {
  _restoreApiKeys()

  document.getElementById('btn-save-api').addEventListener('click', _saveApiKeys)
  document.getElementById('btn-reset-partial').addEventListener('click', _resetPartial)
  document.getElementById('btn-reset-full').addEventListener('click', _resetFull)

  document.getElementById('input-alpaca-key').addEventListener('input', _saveApiKeys)
  document.getElementById('input-alpaca-secret').addEventListener('input', _saveApiKeys)
}

// ── API KEYS WIEDERHERSTELLEN ─────────────────────────────
function _restoreApiKeys() {
  try {
    var cached = QuantCache.load()
    if (cached && cached.api) {
      document.getElementById('input-alpaca-key').value = cached.api.alpacaKey || ''
      document.getElementById('input-alpaca-secret').value = cached.api.alpacaSecret || ''
      
      // ── Status-Indikator ──────────────────────────────
      _updateKeyStatus(cached.api.alpacaKey, cached.api.alpacaSecret)
    } else {
      _updateKeyStatus('', '')
    }
  } catch (e) {
    console.warn('[Synchro] API-Keys konnten nicht geladen werden:', e)
    _updateKeyStatus('', '')
  }
}

// ── API KEYS SPEICHERN ────────────────────────────────────
function _saveApiKeys() {
  try {
    var key    = document.getElementById('input-alpaca-key').value.trim()
    var secret = document.getElementById('input-alpaca-secret').value.trim()

    QuantCache.saveApi({
      alpacaKey:    key,
      alpacaSecret: secret
    })

    _updateKeyStatus(key, secret)
    _showNotification('✅ API-Keys gespeichert', 'success')
  } catch (e) {
    _showNotification('❌ Speichern fehlgeschlagen', 'error')
    console.error(e)
  }
}

// ── STATUS-INDIKATOR AKTUALISIEREN ────────────────────────
function _updateKeyStatus(key, secret) {
  var statusEl = document.getElementById('api-key-status')
  if (!statusEl) return

  if (key && secret) {
    statusEl.innerHTML = '✅ <span style="color:#26a69a;">API-Keys konfiguriert</span>'
  } else {
    statusEl.innerHTML = '⚠️ <span style="color:#ef5350;">Keine API-Keys</span>'
  }
}

// ── PARTIAL RESET ─────────────────────────────────────────
function _resetPartial() {
  if (!confirm('Layout & Parameter zurücksetzen?\n\nAPI-Keys bleiben erhalten.')) return

  try {
    QuantCache.resetPartial()
    _showNotification('✅ Partial Reset erfolgreich – Seite wird neu geladen', 'success')
    setTimeout(() => location.reload(), 1000)
  } catch (e) {
    _showNotification('❌ Reset fehlgeschlagen', 'error')
    console.error(e)
  }
}

// ── FULL RESET ────────────────────────────────────────────
function _resetFull() {
  if (!confirm('⚠️ FULL RESET\n\nALLE Daten werden gelöscht:\n• Layout\n• Parameter\n• API-Keys\n\nFortfahren?')) return

  try {
    QuantCache.resetFull()
    _showNotification('✅ Full Reset erfolgreich – Seite wird neu geladen', 'success')
    setTimeout(() => location.reload(), 1000)
  } catch (e) {
    _showNotification('❌ Reset fehlgeschlagen', 'error')
    console.error(e)
  }
}

// ── NOTIFICATION HELPER ───────────────────────────────────
function _showNotification(msg, type) {
  var notif = document.getElementById('synchro-notification')
  if (!notif) return

  notif.textContent = msg
  notif.className = 'synchro-notification show ' + type

  setTimeout(() => {
    notif.classList.remove('show')
  }, 3000)
}