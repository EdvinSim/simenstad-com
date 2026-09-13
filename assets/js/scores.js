const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuu01Tz5oDXJ_xB0g88pjttSkygdbLi1Ihuh3bGAREfi-v2b6IZFC0GG7mfUym5sejLV7Db-kxrRhh/pub?output=csv';

const fallbackProducts = [];

const inventoryEl = document.getElementById('inventory');
const emptyStateEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

function parseCSV(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current);
      if (row.some(cell => cell !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  return rows;
}

function getCellValue(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return '';
}

function parseDurationToSeconds(value) {
  if (!value) return 0;
  const cleaned = String(value).trim();
  if (!cleaned) return 0;

  const match = cleaned.match(/(\d+):(\d{1,2})/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }

  const numeric = Number(cleaned.replace(/[^0-9,\.]/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapSheetRows(rows) {
  if (!rows || rows.length < 2) return fallbackProducts;

  const headers = rows[0].map(header => normalizeHeader(header));
  const productRows = rows.slice(1);

  return productRows
    .map(row => {
      const obj = {};
      headers.forEach((key, index) => {
        obj[key] = row[index] || '';
      });

      const title = getCellValue(obj, ['tittel', 'title']) || 'Uten tittel';
      const composer = getCellValue(obj, ['komponist', 'composer']) || 'Ukjent komponist';
      const ensemble = getCellValue(obj, ['besetning', 'ensemble', 'instrument', 'instrumenter']) || 'Ukjent besetning';
      const genre = getCellValue(obj, ['sjanger', 'genre']) || 'Original';
      const time = getCellValue(obj, ['tid', 'time', 'duration']) || '—';
      const audioUrl = getCellValue(obj, ['lyd', 'audio', 'audioUrl', 'soundcloud', 'youtube']) || '';
      const buyUrl = getCellValue(obj, ['kjop', 'kjøp', 'buy', 'buyurl', 'purchase']) || 'mailto:edvin@simenstad.com?subject=Kjøp%20noter';

      return {
        title,
        composer,
        ensemble,
        genre,
        time,
        audioUrl,
        buyUrl,
        durationSeconds: parseDurationToSeconds(time)
      };
    })
    .filter(product => product.title && product.title !== '');
}

function formatTimeLabel(value) {
  if (!value || String(value).trim() === '—') return '—';
  const text = String(value).trim();
  const numeric = Number(text.replace(',', '.'));
  if (!Number.isNaN(numeric) && !text.includes(':')) {
    return `${numeric} min`;
  }
  return text;
}

function getFilteredProducts() {
  const query = searchInput.value.trim().toLowerCase();
  let products = [...window.scoreProducts];

  if (query) {
    products = products.filter(product => {
      const haystack = [
        product.title,
        product.composer,
        product.ensemble,
        product.genre,
        product.time
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  const mode = sortSelect.value;
  products.sort((a, b) => {
    if (mode === 'composer-asc') return (a.composer || '').localeCompare(b.composer || '', 'nb');
    if (mode === 'time-asc') return (a.durationSeconds || 0) - (b.durationSeconds || 0);
    if (mode === 'time-desc') return (b.durationSeconds || 0) - (a.durationSeconds || 0);
    return (a.title || '').localeCompare(b.title || '', 'nb');
  });

  return products;
}

function renderProducts() {
  const products = getFilteredProducts();

  if (!products.length) {
    inventoryEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';
  inventoryEl.innerHTML = products.map(product => `
    <article class="score-card">
      <div class="meta">
        <span>${escapeHtml(product.genre || 'Original')}</span>
        <span>${escapeHtml(formatTimeLabel(product.time))}</span>
      </div>
      <h3>${escapeHtml(product.title || 'Uten tittel')}</h3>
      <div class="composer">${escapeHtml(product.composer || 'Ukjent komponist')}</div>

      <div class="pill-row">
        <span class="pill">${escapeHtml(product.ensemble || 'Ukjent besetning')}</span>
        ${product.audioUrl ? '<span class="pill">Lyd</span>' : ''}
      </div>

      <div class="price-row">
        <div class="price"> </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          ${product.audioUrl ? `<a class="buy-btn" href="${escapeAttribute(product.audioUrl)}" target="_blank" rel="noopener noreferrer">Lytt</a>` : ''}
          <a class="buy-btn" href="${escapeAttribute(product.buyUrl || 'mailto:edvin@simenstad.com?subject=Kjøp%20noter')}" target="_blank" rel="noopener noreferrer">Kjøp</a>
        </div>
      </div>
    </article>
  `).join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function loadProducts() {
  try {
    const response = await fetch(SHEET_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Google Sheet not available');

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    const products = mapSheetRows(rows);
    window.scoreProducts = products.length ? products : fallbackProducts;
  } catch (error) {
    window.scoreProducts = [];
  }

  renderProducts();
}

searchInput.addEventListener('input', renderProducts);
sortSelect.addEventListener('change', renderProducts);

window.scoreProducts = [];
loadProducts();
