// QuantOS Cache – frontend/js/cache.js
window.QuantCache = (function () {
  var STORAGE_KEY = 'quantos_v1';

  var DEFAULTS = {
    layout: {
      perfSize:     15,
      bodySize:     85,
      chartSize:    65,
      equitySize:   35,
      panelsSize:   78,
      controlsSize: 22
    },
    params: {
      symbol:     'SPY',
      interval:   '1d',
      start:      '2024-01-01',
      end:        '2025-01-01',
      capital:    10000,
      sma:        20,
      strategy:   '',
      indicators: []
    },
    api: {
      alpacaKey:    '',
      alpacaSecret: ''
    }
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(DEFAULTS);
      var parsed = JSON.parse(raw);
      return {
        layout: Object.assign({}, DEFAULTS.layout, parsed.layout || {}),
        params: Object.assign({}, DEFAULTS.params, parsed.params || {}),
        api:    Object.assign({}, DEFAULTS.api,    parsed.api    || {})
      };
    } catch (e) {
      console.warn('[QuantCache] load() fehlgeschlagen, nutze Defaults:', e);
      return deepClone(DEFAULTS);
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[QuantCache] save() fehlgeschlagen:', e);
    }
  }

  function saveLayout(patch) {
    try {
      var s = load();
      Object.assign(s.layout, patch);
      save(s);
    } catch (e) {}
  }

  function saveParams(patch) {
    try {
      var s = load();
      Object.assign(s.params, patch);
      save(s);
    } catch (e) {}
  }

  function saveApi(patch) {
    try {
      var s = load();
      Object.assign(s.api, patch);
      save(s);
    } catch (e) {}
  }

  function resetPartial() {
    try {
      var s = load();
      s.layout = deepClone(DEFAULTS.layout);
      s.params = deepClone(DEFAULTS.params);
      // API-Keys BEHALTEN
      save(s);
      console.log('[QuantCache] Partial Reset – API-Keys behalten');
    } catch (e) {}
  }

  function resetFull() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[QuantCache] Full Reset – alles gelöscht');
    } catch (e) {}
  }

  // Public API
  return {
    load:         load,
    save:         save,
    saveLayout:   saveLayout,
    saveParams:   saveParams,
    saveApi:      saveApi,
    resetPartial: resetPartial,
    resetFull:    resetFull
  };
})();
