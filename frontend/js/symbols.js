// frontend/js/symbols.js
// Symbol Browser Modal mit Gruppierung + Toggle

let symbolData = null;
let currentView = 'grouped'; // 'grouped' oder 'alphabetical'

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
      symbolData = data;
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
  // Toggle-Button hinzufügen falls noch nicht vorhanden
  let toggleBtn = document.getElementById('view-toggle');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'view-toggle';
    toggleBtn.className = 'view-toggle';
    toggleBtn.innerHTML = '📋 Alphabetisch';
    document.querySelector('.modal-header').appendChild(toggleBtn);
    
    toggleBtn.addEventListener('click', () => {
      currentView = currentView === 'grouped' ? 'alphabetical' : 'grouped';
      toggleBtn.innerHTML = currentView === 'grouped' ? '📋 Alphabetisch' : '📊 Gruppiert';
      renderView();
    });
  }

  if (currentView === 'grouped') {
    renderGrouped(symbolData.groups);
  } else {
    renderFlat(symbolData.flat);
  }
}

function renderGrouped(groups) {
  const icons = {
    "ETFs": "📊",
    "Large Cap Stocks": "🏢",
    "Mid Cap Stocks": "📈",
    "Small Cap Stocks": "🔹"
  };

  symbolList.innerHTML = Object.entries(groups).map(([groupName, symbols]) => {
    if (symbols.length === 0) return '';
    
    const icon = icons[groupName] || "📁";
    return `
      <div class="symbol-group">
        <div class="group-header" data-group="${groupName}">
          <span class="group-icon">${icon}</span>
          <span class="group-title">${groupName}</span>
          <span class="group-count">${symbols.length}</span>
          <span class="group-toggle">▼</span>
        </div>
        <div class="group-content">
          ${symbols.map(s => `
            <div class="symbol-row" data-symbol="${s.symbol}">
              <div class="symbol-info">
                <span class="symbol-ticker">${s.symbol}</span>
                <span class="symbol-name">${s.name}</span>
              </div>
              <span class="symbol-exchange">${s.exchange}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  attachRowHandlers();
  attachGroupToggle();
}

function renderFlat(symbols) {
  if (symbols.length === 0) {
    symbolList.innerHTML = '<p class="no-results">Keine Symbole gefunden</p>';
    return;
  }

  symbolList.innerHTML = symbols.map(s => `
    <div class="symbol-row" data-symbol="${s.symbol}">
      <div class="symbol-info">
        <span class="symbol-ticker">${s.symbol}</span>
        <span class="symbol-name">${s.name}</span>
      </div>
      <span class="symbol-exchange">${s.exchange}</span>
    </div>
  `).join('');

  attachRowHandlers();
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

// Live-Suche
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    renderView();
    return;
  }

  // Suche in Flat-Liste
  const filtered = symbolData.flat.filter(s =>
    s.symbol.toLowerCase().includes(query) ||
    s.name.toLowerCase().includes(query)
  );
  
  renderFlat(filtered);
});
