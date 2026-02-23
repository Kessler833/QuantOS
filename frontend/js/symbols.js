// frontend/js/symbols.js
let symbolData = null;
let sortMode = 'alphabetical';
const BATCH_SIZE = 50;
let groupOffsets = {};
let observers = []; // IntersectionObserver speichern

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
  // Observer cleanup
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
    'type': '📊 Asset Type',
    'market_cap': '💰 Market Cap',
    'sector': '🏭 Sector',
    'popularity': '🔥 Popular'
  };
  btn.innerHTML = labels[sortMode];
}

// ── GRUPPIERUNG ──────────────────────────────────────────
function getGroups() {
  switch (sortMode) {
    case 'type':       return groupBy(symbolData, 'type');
    case 'sector':     return groupBy(symbolData, 'sector');
    case 'market_cap': return groupByMarketCap(symbolData);
    case 'popularity': return groupByPopularity(symbolData);
    default:           return { "All Symbols": symbolData };
  }
}

function groupBy(symbols, key) {
  return symbols.reduce((acc, s) => {
    const g = s[key] || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
}

function groupByMarketCap(symbols) {
  const order = ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap"];
  const grouped = groupBy(symbols, 'market_cap');
  return Object.fromEntries(order.filter(c => grouped[c]).map(c => [c, grouped[c]]));
}

function groupByPopularity(symbols) {
  return {
    "Most Popular": symbols.filter(s => s.is_popular).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    "Other":        symbols.filter(s => !s.is_popular).sort((a, b) => a.symbol.localeCompare(b.symbol))
  };
}

// ── RENDER MIT AUTO INFINITE SCROLL ──────────────────────
function renderGrouped() {
  const groups = getGroups();

  const icons = {
  // Asset Types
  "Stock": "📈",
  "Index ETF": "📊",
  "Sector ETF": "🎯",
  "Bond ETF": "💵",
  "Commodity ETF": "🥇",
  "International ETF": "🌍",
  "Crypto & Blockchain": "₿",
  "Other ETF": "📦",
  
  // Sectors
  "Technology": "💻",
  "Healthcare": "🏥",
  "Finance": "💳",
  "Consumer": "🛒",
  "Energy": "⚡",
  "Industrial": "🏭",
  "Utilities": "💡",
  
  // Market Cap
  "Mega Cap": "🏢",
  "Large Cap": "🏬",
  "Mid Cap": "🏪",
  "Small Cap": "🔹",
  
  // Other
  "Most Popular": "🔥",
  "All Symbols": "🔤",
  "Other": "📁"
};


  symbolList.innerHTML = Object.entries(groups).map(([groupName, symbols]) => {
    if (symbols.length === 0) return '';

    groupOffsets[groupName] = BATCH_SIZE;
    const initial = symbols.slice(0, BATCH_SIZE);
    const hasMore = symbols.length > BATCH_SIZE;
    const icon = icons[groupName] || "📁";

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

// ── INTERSECTION OBSERVER FÜR AUTO-SCROLL ────────────────
function attachScrollObservers(groups) {
  document.querySelectorAll('.scroll-trigger').forEach(trigger => {
    const groupName = trigger.dataset.group;
    const allSymbols = groups[groupName];
    const container = trigger.previousElementSibling; // .group-symbols

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const offset = groupOffsets[groupName];
        if (offset >= allSymbols.length) {
          trigger.remove();
          observer.disconnect();
          return;
        }

        // Nächsten Batch laden
        const nextBatch = allSymbols.slice(offset, offset + BATCH_SIZE);
        groupOffsets[groupName] = offset + BATCH_SIZE;

        container.insertAdjacentHTML('beforeend', renderRows(nextBatch));
        attachRowHandlers();

        // Fertig? Trigger entfernen
        if (groupOffsets[groupName] >= allSymbols.length) {
          trigger.remove();
          observer.disconnect();
        }
      });
    }, {
      root: symbolList,
      rootMargin: '100px', // Lädt schon 100px vor Ende
      threshold: 0.1
    });

    observer.observe(trigger);
    observers.push(observer);
  });
}

// ── HANDLERS ─────────────────────────────────────────────
function attachRowHandlers() {
  document.querySelectorAll('.symbol-row').forEach(row => {
    // Nur neue Rows, die noch keinen Listener haben
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
