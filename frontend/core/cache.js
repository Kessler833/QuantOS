const CACHE_KEY = 'QuantOS_Cache'

const QuantCache = {
  load() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.warn('[Cache] Load failed:', e)
      return null
    }
  },
  save(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) }
    catch (e) { console.error('[Cache] Save failed:', e) }
  },
  saveApi(apiData) {
    const cached = this.load() || {}
    cached.api = apiData
    this.save(cached)
  },
  saveParams(params) {
    const cached = this.load() || {}
    cached.params = params
    this.save(cached)
  },
  saveLayout(layout) {
    const cached = this.load() || {}
    cached.layout = { ...cached.layout, ...layout }
    this.save(cached)
  },
  resetPartial() {
    const api = (this.load() || {}).api
    this.save({ api })
  },
  resetFull() {
    localStorage.removeItem(CACHE_KEY)
  }
}

window.QuantCache = QuantCache;
