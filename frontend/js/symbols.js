// frontend/js/symbols.js
let symbolData = null;
let sortMode = 'alphabetical';
const BATCH_SIZE = 50;
let groupOffsets = {};
let observers = [];

const modal = document.getElementById('symbol-modal');
const btnBrowse = document.getElementById('btn-browse-symbols');
const btnClose = document.querySelector('.modal-close');
const symbolInput = document.getElementById('ctrl-symbol');
const searchInput = document.getElementById('symbol-search');
const symbolList = document.getElementById('symbol-list');

btnBrowse.addEventListener('click', openModal);
btnClose.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// ── CACHE LADEN ──────────────────────────────────────────
async function preloadSymbols() {
  if (symbolData) return;
  try {
    const res = await fetch('http://localhost:8000/api/symbols');
    const data = await res.json();

    if (Array.isArray(data)) {
      symbolData = data;
    } else if (data.symbols && Array.isArray(data.symbols)) {
      symbolData = data.symbols;
    } else {
      throw new Error('Invalid data format');
    }
    console.log('✅ Symbols cached:', symbolData.length);
  } catch (err) {
    console.error('❌ Cache load failed:', err);
  }
}

preloadSymbols();

// ── MODAL ────────────────────────────────────────────────
async function openModal() {
  modal.style.display = 'flex';
  searchInput.value = '';
  searchInput.focus();

  if (!symbolData) {
    symbolList.innerHTML = '<p class="loading">⏳ Lade Symbole...</p>';
    await preloadSymbols();
  }

  renderView();
}

function closeModal() {
  modal.style.display = 'none';
  observers.forEach(o => o.disconnect());
  observers = [];
}

// ── VIEW ─────────────────────────────────────────────────
function renderView() {
  let sortBtn = document.getElementById('sort-toggle');
  if (!sortBtn) {
    sortBtn = document.createElement('button');
    sortBtn.id = 'sort-toggle';
    sortBtn.className = 'sort-toggle';
    document.querySelector('.modal-header').appendChild(sortBtn);
    sortBtn.addEventListener('click', cycleSortMode);
  }

  updateSortButton(sortBtn);
  groupOffsets = {};
  observers.forEach(o => o.disconnect());
  observers = [];
  renderGrouped();
}

function cycleSortMode() {
  const modes = ['alphabetical', 'type', 'market_cap', 'sector', 'popularity'];
  sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length];
  renderView();
}

function updateSortButton(btn) {
  const labels = {
    'alphabetical': '🔤 A-Z',
    'type':         '📊 Asset Type',
    'market_cap':   '💰 Market Cap',
    'sector':       '🏭 Sector',
    'popularity':   '🔥 Popular'
  };
  btn.innerHTML = labels[sortMode];
}

// ── ICONS ────────────────────────────────────────────────
const GROUP_ICONS = {
  "Crypto Pairs":        "₿",
  "Index ETF":           "📊",
  "Sector ETF":          "🎯",
  "Bond ETF":            "💵",
  "Commodity ETF":       "🥇",
  "International ETF":   "🌍",
  "Crypto & Blockchain": "🔗",
  "Other ETF":           "📦",
  "Stock":               "📈",

  "Technology":  "💻",
  "Healthcare":  "🏥",
  "Finance":     "💳",
  "Consumer":    "🛒",
  "Energy":      "⚡",
  "Industrial":  "🏭",
  "Utilities":   "💡",
  "Real Estate": "🏠",
  "Materials":   "⚗️",
  "Other":       "📁",

  "Mega Cap":  "🏢",
  "Large Cap": "🏬",
  "Mid Cap":   "🏪",
  "Small Cap": "🔹",

  "Most Popular": "🔥",
};

// ── GRUPPIERUNG ──────────────────────────────────────────
function groupBy(symbols, key) {
  return symbols.reduce((acc, s) => {
    const g = s[key] || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
}

function groupByType(symbols) {
  const order = [
    "Crypto Pairs",
    "Index ETF",
    "Sector ETF",
    "Bond ETF",
    "Commodity ETF",
    "International ETF",
    "Crypto & Blockchain",
    "Other ETF",
    "Stock"
  ];

  const raw = symbols.reduce((acc, s) => {
    const type = s.symbol.includes('/') ? 'Crypto Pairs' : (s.type || 'Stock');
    if (!acc[type]) acc[type] = [];
    acc[type].push(s);
    return acc;
  }, {});

  return Object.fromEntries(order.filter(t => raw[t]).map(t => [t, raw[t]]));
}

function groupByMarketCap(symbols) {
  const order = ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap"];
  const stocks = symbols.filter(s => !s.symbol.includes('/') && s.type === 'Stock');
  const etfs = symbols.filter(s => s.type && s.type.includes('ETF'));
  const crypto = symbols.filter(s => s.symbol.includes('/'));

  const grouped = stocks.reduce((acc, s) => {
    const g = s.market_cap || 'Small Cap';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  const result = Object.fromEntries(order.filter(c => grouped[c]).map(c => [c, grouped[c]]));
  if (etfs.length > 0) result["ETFs"] = etfs;
  if (crypto.length > 0) result["Crypto Pairs"] = crypto;
  return result;
}

function groupBySector(symbols) {
  const order = [
    "Technology", "Healthcare", "Finance", "Consumer",
    "Energy", "Industrial", "Utilities", "Real Estate", "Materials", "Other"
  ];

  const stocks = symbols.filter(s => !s.symbol.includes('/') && s.type === 'Stock');
  const etfs = symbols.filter(s => s.type && s.type.includes('ETF'));
  const crypto = symbols.filter(s => s.symbol.includes('/'));

  const grouped = stocks.reduce((acc, s) => {
    const g = s.sector || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  const result = Object.fromEntries(order.filter(sec => grouped[sec]).map(sec => [sec, grouped[sec]]));
  if (etfs.length > 0) result["ETFs"] = etfs;
  if (crypto.length > 0) result["Crypto Pairs"] = crypto;
  return result;
}

// ── RENDER ────────────────────────────────────────────────
function renderGrouped() {
  // 1) Alphabetisch: flache Liste A–Z
  if (sortMode === 'alphabetical') {
    const list = [...symbolData].sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
    );
    renderFlatWithInfiniteScroll(list, 'alphabetical');
    return;
  }

  // 2) Popular: flache Liste, nur "is_popular", absteigend, max 1000
  if (sortMode === 'popularity') {
    const popular = symbolData
      .filter(s => s.is_popular)
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .slice(0, 1000);

    renderFlatWithInfiniteScroll(popular, 'popular');
    return;
  }

  // 3) Alle anderen: gruppiert
  let groups = {};
  switch (sortMode) {
    case 'type':       groups = groupByType(symbolData);      break;
    case 'market_cap': groups = groupByMarketCap(symbolData); break;
    case 'sector':     groups = groupBySector(symbolData);    break;
  }

  symbolList.innerHTML = Object.entries(groups).map(([groupName, symbols]) => {
    if (!symbols || symbols.length === 0) return '';

    groupOffsets[groupName] = BATCH_SIZE;
    const initial = symbols.slice(0, BATCH_SIZE);
    const hasMore = symbols.length > BATCH_SIZE;
    const icon = GROUP_ICONS[groupName] || "📁";

    return `
      <div class="symbol-group" data-group="${groupName}">
        <div class="group-header">
          <span class="group-icon">${icon}</span>
          <span class="group-title">${groupName}</span>
          <span class="group-count">${symbols.length}</span>
          <span class="group-toggle">▼</span>
        </div>
        <div class="group-content" style="display: none;">
          <div class="group-symbols" data-group="${groupName}">
            ${renderRows(initial)}
          </div>
          ${hasMore ? `
            <div class="scroll-trigger" data-group="${groupName}">
              <div class="loading-spinner">⏳ Lädt mehr...</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  attachRowHandlers();
  attachGroupToggle();
  attachScrollObservers(groups);
}

// flache Liste mit Auto-Infinite-Scroll (für Alphabetical & Popular)
function renderFlatWithInfiniteScroll(list, groupName) {
  groupOffsets[groupName] = BATCH_SIZE;
  const initial = list.slice(0, BATCH_SIZE);
  const hasMore = list.length > BATCH_SIZE;

  symbolList.innerHTML = `
    <div class="group-symbols" data-group="${groupName}">
      ${renderRows(initial)}
    </div>
    ${hasMore ? `
      <div class="scroll-trigger" data-group="${groupName}">
        <div class="loading-spinner">⏳ Lädt mehr...</div>
      </div>
    ` : ''}
  `;

  attachRowHandlers();
  attachScrollObservers({ [groupName]: list });
}

function renderRows(symbols) {
  return symbols.map(s => `
    <div class="symbol-row" data-symbol="${s.symbol}">
      <div class="symbol-info">
        <span class="symbol-ticker">${s.symbol}</span>
        <span class="symbol-name">${s.name}</span>
      </div>
      <span class="symbol-exchange">${s.exchange}</span>
    </div>
  `).join('');
}

// ── INTERSECTION OBSERVER ─────────────────────────────────
function attachScrollObservers(groups) {
  document.querySelectorAll('.scroll-trigger').forEach(trigger => {
    const groupName = trigger.dataset.group;
    const allSymbols = groups[groupName];
    if (!allSymbols) return;

    const container = trigger.previousElementSibling;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const offset = groupOffsets[groupName];
        if (offset >= allSymbols.length) {
          trigger.remove();
          observer.disconnect();
          return;
        }

        const nextBatch = allSymbols.slice(offset, offset + BATCH_SIZE);
        groupOffsets[groupName] = offset + BATCH_SIZE;

        container.insertAdjacentHTML('beforeend', renderRows(nextBatch));
        attachRowHandlers();

        if (groupOffsets[groupName] >= allSymbols.length) {
          trigger.remove();
          observer.disconnect();
        }
      });
    }, {
      root: symbolList,
      rootMargin: '100px',
      threshold: 0.1
    });

    observer.observe(trigger);
    observers.push(observer);
  });
}

// ── HANDLERS ─────────────────────────────────────────────
function attachRowHandlers() {
  document.querySelectorAll('.symbol-row').forEach(row => {
    if (row.dataset.hasListener) return;
    row.dataset.hasListener = 'true';
    row.addEventListener('click', () => {
      symbolInput.value = row.dataset.symbol;
      closeModal();
    });
  });
}

function attachGroupToggle() {
  document.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const toggle = header.querySelector('.group-toggle');
      content.style.display = content.style.display === 'none' ? 'flex' : 'none';
      toggle.textContent = content.style.display === 'none' ? '▶' : '▼';
    });
  });
}

// ── LIVE-SUCHE ───────────────────────────────────────────
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();

  if (!query) {
    renderView();
    return;
  }

  const filtered = symbolData
    .filter(s =>
      s.symbol.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query)
    )
    .slice(0, 100);

  symbolList.innerHTML = filtered.length
    ? filtered.map(s => `
        <div class="symbol-row" data-symbol="${s.symbol}">
          <div class="symbol-info">
            <span class="symbol-ticker">${s.symbol}</span>
            <span class="symbol-name">${s.name}</span>
          </div>
          <span class="symbol-exchange">${s.exchange}</span>
        </div>
      `).join('')
    : '<p class="no-results">Keine Symbole gefunden</p>';

  attachRowHandlers();
});
