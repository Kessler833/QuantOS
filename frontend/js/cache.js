// ══════════════════════════════════════════════
//  QuantOS Cache — LocalStorage Persistence
//  Reguläres Script, kein ES-Modul
// ══════════════════════════════════════════════

(function () {
  const CACHE_VERSION = "1.0";
  const CACHE_KEY     = "quantos_cache";

  const DEFAULTS = {
    version: CACHE_VERSION,
    layout: {
      perfSize:     15,
      bodySize:     85,
      chartSize:    65,
      equitySize:   35,
      panelsSize:   78,
      controlsSize: 22
    },
    params: {
      symbol:     "SPY",
      interval:   "1d",
      start:      "2024-01-01",
      end:        "2025-01-01",
      capital:    10000,
      sma:        20,
      strategy:   "",
      indicators: []
    }
  };

  window.QuantCache = {

    load: function () {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return this._clone(DEFAULTS);
        const cached = JSON.parse(raw);
        if (cached.version !== CACHE_VERSION) {
          console.warn("[Cache] Version geändert – Defaults geladen");
          return this._clone(DEFAULTS);
        }
        // Merge: neue Felder aus DEFAULTS auffüllen falls nicht vorhanden
        return {
          version: cached.version,
          layout:  Object.assign({}, DEFAULTS.layout,  cached.layout  || {}),
          params:  Object.assign({}, DEFAULTS.params,  cached.params  || {})
        };
      } catch (e) {
        console.error("[Cache] Laden fehlgeschlagen:", e);
        return this._clone(DEFAULTS);
      }
    },

    save: function (state) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error("[Cache] Speichern fehlgeschlagen:", e);
      }
    },

    saveLayout: function (patch) {
      const s = this.load();
      Object.assign(s.layout, patch);
      this.save(s);
    },

    saveParams: function (patch) {
      const s = this.load();
      Object.assign(s.params, patch);
      this.save(s);
    },

    reset: function () {
      localStorage.removeItem(CACHE_KEY);
      console.log("[Cache] Zurückgesetzt");
      return this._clone(DEFAULTS);
    },

    _clone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  };

})();
