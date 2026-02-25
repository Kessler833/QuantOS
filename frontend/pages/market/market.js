// frontend/pages/market/market.js

// Globale State-Variablen für Heatmap
let heatmapSource = null;
let heatmapEtaSeconds = null;
let heatmapEtaTimer = null;
let heatmapInitialized = false; // verhindert Doppel-Load


// ETA-Label aktualisieren
function updateEtaDisplay(seconds) {
  const el = document.querySelector('#heatmap-eta');
  if (!el) return;

  if (seconds == null) {
    el.textContent = '';
    return;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  el.textContent = 'ETA: ' + m + ':' + s.toString().padStart(2, '0');
}


// Lokaler Countdown zwischen Server-Updates
function startEtaTimer() {
  if (heatmapEtaTimer) clearInterval(heatmapEtaTimer);
  if (heatmapEtaSeconds == null) return;

  heatmapEtaTimer = setInterval(function () {
    if (heatmapEtaSeconds <= 0) {
      clearInterval(heatmapEtaTimer);
      heatmapEtaTimer = null;
      return;
    }
    heatmapEtaSeconds -= 1;
    updateEtaDisplay(heatmapEtaSeconds);
  }, 1000);
}


// Status-Label
function updateHeatmapStatus(text) {
  const el = document.querySelector('#heatmap-status');
  if (!el) return;
  el.textContent = text || '';
}


// Progress-Bar
function updateHeatmapProgress(progress) {
  const el = document.querySelector('#heatmap-progress');
  if (!el) return;
  const value = Math.max(0, Math.min(100, progress || 0));
  el.style.width = value + '%';
}


// Heatmap laden
async function _loadHeatmap() {
  // Laufenden Stream schließen
  if (heatmapSource) {
    heatmapSource.close();
    heatmapSource = null;
  }

  // API-Keys aus Cache (window.QuantCache wird jetzt korrekt gesetzt)
  const cache = window.QuantCache ? window.QuantCache.load() : null;

  const alpacaKey    = (cache && cache.api && cache.api.alpacaKey)    ? cache.api.alpacaKey    : '';
  const alpacaSecret = (cache && cache.api && cache.api.alpacaSecret) ? cache.api.alpacaSecret : '';

  if (!alpacaKey || !alpacaSecret) {
    updateHeatmapStatus('Keine API-Keys konfiguriert.');
    return;
  }

  updateHeatmapStatus('Verbinde zum Server...');
  updateEtaDisplay(null);
  updateHeatmapProgress(0);

  // Keys via Query-Params (SSE kann kein POST-Body)
  const url = 'http://localhost:8000/api/heatmap/stream';
  const qs = new URLSearchParams({
    alpaca_key: alpacaKey,
    alpaca_secret: alpacaSecret,
  }).toString();

  heatmapSource = new EventSource(url + '?' + qs);

  heatmapSource.onopen = function () {
    updateHeatmapStatus('Verbindung hergestellt. Lade Daten...');
  };

  heatmapSource.onerror = function (err) {
    console.error('Heatmap SSE error', err);
    updateHeatmapStatus('Fehler beim Laden der Heatmap.');
    if (heatmapSource) {
      heatmapSource.close();
      heatmapSource = null;
    }
  };

  heatmapSource.onmessage = function (event) {
    if (!event.data) return;

    var data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.warn('Invalid SSE data', event.data);
      return;
    }

    if (data.error) {
      updateHeatmapStatus('Fehler: ' + data.error);
      return;
    }

    // ETA übernehmen + Countdown starten
    if (data.eta_seconds !== undefined && data.eta_seconds !== null) {
      heatmapEtaSeconds = data.eta_seconds;
      updateEtaDisplay(heatmapEtaSeconds);
      startEtaTimer();
    }

    if (data.stage === 'symbols') {
      updateHeatmapStatus(data.message || 'Lade Symbolliste...');

    } else if (data.stage === 'loading-cache') {
      updateHeatmapStatus(data.message || 'Lade aus Cache...');
      updateHeatmapProgress(data.progress || 100);

    } else if (data.stage === 'loading-init') {
      updateHeatmapStatus(data.message || 'Starte Datenladen...');

    } else if (data.stage === 'batch_start') {
      updateHeatmapStatus(
        data.message || ('Starte Batch ' + data.batch + '/' + data.total_batches + '...')
      );

    } else if (data.stage === 'batch_done') {
      updateHeatmapStatus(
        data.message || ('Batch ' + data.batch + '/' + data.total_batches + ' abgeschlossen')
      );
      if (typeof data.progress === 'number') {
        updateHeatmapProgress(data.progress);
      }

    } else if (data.stage === 'calculating') {
      updateHeatmapStatus(data.message || 'Berechne Veränderungen...');

    } else if (data.stage === 'done') {
      updateHeatmapStatus('Fertig.');
      updateHeatmapProgress(100);
      heatmapEtaSeconds = 0;
      updateEtaDisplay(0);
      if (heatmapEtaTimer) {
        clearInterval(heatmapEtaTimer);
        heatmapEtaTimer = null;
      }

      const grid = document.querySelector('#heatmap-grid');
      if (grid) {
        grid.innerHTML = '';
        // TODO: renderHeatmap(data.symbols);
      }

      heatmapSource.close();
      heatmapSource = null;
    }
  };
}


// app.js ruft initMarket() beim Start auf
function initMarket() {
  heatmapInitialized = false;
  updateHeatmapStatus('');
  updateEtaDisplay(null);
  updateHeatmapProgress(0);

  const btn = document.querySelector('#btn-refresh-heatmap');
  if (btn) {
    btn.onclick = function () {
      _loadHeatmap();
    };
  }
}

// app.js ruft onMarketActivated() beim Tab-Wechsel auf
function onMarketActivated() {
  if (!heatmapInitialized) {
    heatmapInitialized = true;
    _loadHeatmap();
  }
}

// global registrieren
window.initMarket        = initMarket;
window.onMarketActivated = onMarketActivated;
