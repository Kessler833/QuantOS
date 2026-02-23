// frontend/js/symbols.js
let symbolData = null;
let sortMode = 'alphabetical';
const MAX_INITIAL_ITEMS = 100; // Pro Gruppe

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

async function openModal() {
  modal.style.display = 'flex';
  searchInput.value = '';
  searchInput.focus();

  if (!symbolData) {
    symbolList.innerHTML = '<p class="loading">Lade Symbole...</p>';
    try {
      const res = await fetch('http://localhost:8000/api/symbols');
      const data = await res.json();
      
      // DEBUG: Was gibt die API zurück?
      console.log('Raw API response:', data);
      console.log('Type:', typeof data);
      console.log('Keys:', Object.keys(data));
      
      // Fix: Extrahiere symbols Array
      if (Array.isArray(data)) {
        symbolData = data;
      } else if (data.symbols && Array.isArray(data.symbols)) {
        symbolData = data.symbols;
      } else {
        console.error('Data structure:', data);
        throw new Error('Invalid data format');
      }
      
      console.log('Loaded symbols:', symbolData.length);
      renderView();
    } catch (err) {
      symbolList.innerHTML = '<p class="error">❌ Fehler beim Laden der Symbole</p>';
      console.error(err);
    }
  } else {
    renderView();
  }
}



function closeModal() {
  modal.style.display = 'none';
}

function renderView() {
  // Sortier-Button erstellen
  let sortBtn = document.getElementById('sort-toggle');
  if (!sortBtn) {
    sortBtn = document.createElement('button');
    sortBtn.id = 'sort-toggle';
    sortBtn.className = 'sort-toggle';
    document.querySelector('.modal-header').appendChild(sortBtn);
    sortBtn.addEventListener('click', cycleSortMode);
  }
  
  updateSortButton(sortBtn);
  renderGrouped();
}

function cycleSortMode() {
  const modes = ['alphabetical', 'type', 'market_cap', 'sector', 'popularity'];
  const currentIndex = modes.indexOf(sortMode);
  sortMode = modes[(currentIndex + 1) % modes.length];
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

function renderGrouped() {
  let groups = {};
  
  switch (sortMode) {
    case 'type':
      groups = groupBy(symbolData, 'type');
      break;
    case 'sector':
      groups = groupBy(symbolData, 'sector');
      break;
    case 'market_cap':
      groups = groupByMarketCap(symbolData);
      break;
    case 'popularity':
      groups = groupByPopularity(symbolData);
      break;
    default: // alphabetical
      // Bei alphabetisch: Nur erste 500 anzeigen
      groups = { "All Symbols (showing first 500)": symbolData.slice(0, 500) };
  }
  
  const icons = {
    "Stock": "📈", "ETF": "📊",
    "Technology": "💻", "Healthcare": "🏥", "Finance": "💳",
    "Consumer": "🛒", "Energy": "⚡", "Industrial": "🏭", "Utilities": "💡",
    "Mega Cap": "🏢", "Large Cap": "🏬", "Mid Cap": "🏪", "Small Cap": "🔹",
    "Most Popular": "🔥", "Other": "📁"
  };
  
  symbolList.innerHTML = Object.entries(groups).map(([groupName, symbols]) => {
    if (symbols.length === 0) return '';
    
    // Limit: Max 100 Symbole pro Gruppe anzeigen
    const displaySymbols = symbols.slice(0, MAX_INITIAL_ITEMS);
    const hasMore = symbols.length > MAX_INITIAL_ITEMS;
    
    const icon = icons[groupName] || "📁";
    return `
      <div class="symbol-group">
        <div class="group-header" data-group="${groupName}">
          <span class="group-icon">${icon}</span>
          <span class="group-title">${groupName}</span>
          <span class="group-count">${symbols.length}</span>
          <span class="group-toggle">▼</span>
        </div>
        <div class="group-content" style="display: none;">
          ${displaySymbols.map(s => `
            <div class="symbol-row" data-symbol="${s.symbol}">
              <div class="symbol-info">
                <span class="symbol-ticker">${s.symbol}</span>
                <span class="symbol-name">${s.name}</span>
              </div>
              <span class="symbol-exchange">${s.exchange}</span>
            </div>
          `).join('')}
          ${hasMore ? `<p class="load-more">... ${symbols.length - MAX_INITIAL_ITEMS} weitere (nutze Suche)</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  attachRowHandlers();
  attachGroupToggle();
}

function groupBy(symbols, key) {
  return symbols.reduce((acc, symbol) => {
    const group = symbol[key] || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(symbol);
    return acc;
  }, {});
}

function groupByMarketCap(symbols) {
  const order = ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap"];
  const grouped = groupBy(symbols, 'market_cap');
  return Object.fromEntries(
    order.filter(cap => grouped[cap]).map(cap => [cap, grouped[cap]])
  );
}

function groupByPopularity(symbols) {
  const popular = symbols.filter(s => s.is_popular).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const others = symbols.filter(s => !s.is_popular).sort((a, b) => a.symbol.localeCompare(b.symbol));
  return {
    "Most Popular": popular,
    "Other": others
  };
}

function attachRowHandlers() {
  document.querySelectorAll('.symbol-row').forEach(row => {
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
      
      if (content.style.display === 'none') {
        content.style.display = 'flex';
        toggle.textContent = '▼';
      } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
      }
    });
  });
}

// Live-Suche (WICHTIG für Performance!)
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    renderView();
    return;
  }
  
  // Nur erste 100 Treffer anzeigen
  const filtered = symbolData
    .filter(s => 
      s.symbol.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query)
    )
    .slice(0, 100);
  
  symbolList.innerHTML = filtered.map(s => `
    <div class="symbol-row" data-symbol="${s.symbol}">
      <div class="symbol-info">
        <span class="symbol-ticker">${s.symbol}</span>
        <span class="symbol-name">${s.name}</span>
      </div>
      <span class="symbol-exchange">${s.exchange}</span>
    </div>
  `).join('');
  
  if (filtered.length === 0) {
    symbolList.innerHTML = '<p class="no-results">Keine Symbole gefunden</p>';
  }
  
  attachRowHandlers();
});
