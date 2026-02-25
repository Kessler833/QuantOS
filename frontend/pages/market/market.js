// frontend/pages/market/market.js

// Globale State-Variablen für Heatmap
let heatmapSource = null;
let heatmapEtaSeconds = null;
let heatmapEtaTimer = null;


// Einfaches ETA-Label aktualisieren
function updateEtaDisplay(seconds) {
  const el = document.querySelector('#heatmap-eta');
  if (!el) return;

  if (seconds == null) {
    el.textContent = '';
    return;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  el.textContent = `ETA: ${m}:${s.toString().padStart(2, '0')}`;
}


// Lokaler Countdown zwischen Server-Updates
function startEtaTimer() {
  if (heatmapEtaTimer) clearInterval(heatmapEtaTimer);
  if (heatmapEtaSeconds == null) return;

  heatmapEtaTimer = setInterval(() => {
    if (heatmapEtaSeconds <= 0) {
      clearInterval(heatmapEtaTimer);
      heatmapEtaTimer = null;
      return;
    }
    heatmapEtaSeconds -= 1;
    updateEtaDisplay(heatmapEtaSeconds);
  }, 1000);
}


// Status-Label für aktuelle Stage
function updateHeatmapStatus(text) {
  const el = document.querySelector('#heatmap-status');
  if (!el) return;
  el.textContent = text || '';
}


// Progress-Bar optional
function updateHeatmapProgress(progress) {
  const el = document.querySelector('#heatmap-progress');
  if (!el) return;
  const value = Math.max(0, Math.min(100, progress || 0));
  el.style.width = `${value}%`;
}


// Hauptfunktion zum Laden der Heatmap
async function _loadHeatmap() {
  // Falls schon ein Stream offen ist → schließen
  if (heatmapSource) {
    heatmapSource.close();
    heatmapSource = null;
  }

  // API-Keys aus deinem Cache
  const cache = window.QuantCache ? window.QuantCache.load() : null;
  console.log('Heatmap cache:', cache);

  const alpacaKey =
    cache && cache.api && cache.api.alpacaKey ? cache.api.alpacaKey : '';
  const alpacaSecret =
    cache && cache.api && cache.api.alpacaSecret ? cache.api.alpacaSecret : '';

  if (!alpacaKey || !alpacaSecret) {
    updateHeatmapStatus('Keine API-Keys konfiguriert.');
    return;
  }

  updateHeatmapStatus('Verbinde zum Server...');
  updateEtaDisplay(null);
  updateHeatmapProgress(0);

  // Achtung: dein Backend erwartet die Keys aktuell im Body (HeatmapRequest).
  // Diese Query-Variante funktioniert nur, wenn du den Stream-Endpunkt entsprechend anpasst.
  const url = `/api/market/heatmap/stream`;
  const qs = new URLSearchParams({
    alpaca_key: alpacaKey,
    alpaca_secret: alpacaSecret,
  }).toString();

  heatmapSource = new EventSource(`${url}?${qs}`);

  heatmapSource.onopen = () => {
    updateHeatmapStatus('Verbindung hergestellt. Lade Daten...');
  };

  heatmapSource.onerror = (err) => {
    console.error('Heatmap SSE error', err);
    updateHeatmapStatus('Fehler beim Laden der Heatmap.');
    if (heatmapSource) {
      heatmapSource.close();
      heatmapSource = null;
    }
  };

  heatmapSource.onmessage = (event) => {
    if (!event.data) return;

    let data;
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

    // ETA übernehmen
    if (data.eta_seconds !== undefined && data.eta_seconds !== null) {
      heatmapEtaSeconds = data.eta_seconds;
      updateEtaDisplay(heatmapEtaSeconds);
      startEtaTimer();
    }

    // Stage-bezogene UI
    if (data.stage === 'symbols') {
      updateHeatmapStatus(data.message || 'Lade Symbolliste...');
    } else if (data.stage === 'loading-cache') {
      updateHeatmapStatus(data.message || 'Lade aus Cache...');
      updateHeatmapProgress(data.progress || 100);
    } else if (data.stage === 'loading-init') {
      updateHeatmapStatus(data.message || 'Starte Datenladen...');
    } else if (data.stage === 'batch_start') {
      const msg =
        data.message ||
        ('Starte Batch ' + data.batch + '/' + data.total_batches + '...');
      updateHeatmapStatus(msg);
    } else if (data.stage === 'batch_done') {
      updateHeatmapStatus(
        data.message ||
          ('Batch ' + data.batch + '/' + data.total_batches + ' abgeschlossen')
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

      // Placeholder entfernen / später: Heatmap rendern
      const grid = document.querySelector('#heatmap-grid');
      if (grid) {
        grid.innerHTML = '';
        // TODO: hier deine Kacheln aus data.symbols rendern
      }
    }
  };
}


// von app.js aufgerufen
function initMarket() {
  updateHeatmapStatus('');
  updateEtaDisplay(null);
  updateHeatmapProgress(0);

  const btn = document.querySelector('#btn-refresh-heatmap');
  if (btn) {
    btn.onclick = function () {
      _loadHeatmap();
    };
  }

  _loadHeatmap();
}

// global machen, damit app.js es findet
window.initMarket = initMarket;
window.onMarketActivated = initMarket;
