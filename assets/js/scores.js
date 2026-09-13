const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuu01Tz5oDXJ_xB0g88pjttSkygdbLi1Ihuh3bGAREfi-v2b6IZFC0GG7mfUym5sejLV7Db-kxrRhh/pub?output=csv';

const fallbackProducts = [];

const inventoryEl = document.getElementById('inventory');
const emptyStateEl = document.getElementById('emptyState');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const pageSize = 12;
let currentPage = 1;

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

function parsePublishedValue(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!normalized) return true;
  if (['true', '1', 'yes', 'y', 'ja', 'checked', 'check', '✓', '✔', '☑', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nei', 'unchecked', 'off', '✗', '×'].includes(normalized)) return false;

  return true;
}

function mapSheetRows(rows) {
  if (!rows || rows.length < 2) return fallbackProducts;

  const headers = rows[0].map(header => normalizeHeader(header));
  const publishIndex = headers.findIndex(key => key === 'publiser' || key === 'publish');
  const productRows = rows.slice(1);

  return productRows
    .map(row => {
      const obj = {};
      headers.forEach((key, index) => {
        obj[key] = row[index] || '';
      });

      if (publishIndex >= 0 && !parsePublishedValue(row[publishIndex])) {
        return null;
      }

      const title = getCellValue(obj, ['tittel', 'title']) || 'Uten tittel';
      const composer = getCellValue(obj, ['komponist', 'composer']) || 'Ukjent komponist';
      const ensemble = getCellValue(obj, ['besetning', 'ensemble', 'instrument', 'instrumenter']) || 'Ukjent besetning';
      const genre = getCellValue(obj, ['sjanger', 'genre']) || 'Original';
      const time = getCellValue(obj, ['tid', 'time', 'duration']) || '—';
      const previewUrl = getCellValue(obj, ['noteeksempel', 'vis', 'preview', 'previewurl', 'sample', 'demo', 'demourl']) || '';
      const audioUrl = getCellValue(obj, ['lyd', 'audio', 'audioUrl', 'soundcloud', 'youtube']) || '';
      const buyUrl = getCellValue(obj, ['kjop', 'kjøp', 'buy', 'buyurl', 'purchase']) || '';

      return {
        title,
        composer,
        ensemble,
        genre,
        time,
        previewUrl: resolveDriveUrl(previewUrl),
        audioUrl: resolveDriveUrl(audioUrl),
        buyUrl: resolveDriveUrl(buyUrl),
        durationSeconds: parseDurationToSeconds(time)
      };
    })
    .filter(product => product && product.title && product.title !== '');
}

function resolveDriveUrl(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    if (/drive\.google\.com\/file\/d\//i.test(trimmed) || /drive\.google\.com\/uc\?/i.test(trimmed)) {
      const idMatch = trimmed.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/);
      if (idMatch) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
    }
    return trimmed;
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return `https://drive.google.com/uc?export=view&id=${trimmed}`;
  }

  return trimmed;
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
    if (mode === 'ensemble-asc') return (a.ensemble || '').localeCompare(b.ensemble || '', 'nb');
    if (mode === 'genre-asc') return (a.genre || '').localeCompare(b.genre || '', 'nb');
    if (mode === 'time-asc') return (a.durationSeconds || 0) - (b.durationSeconds || 0);
    if (mode === 'time-desc') return (b.durationSeconds || 0) - (a.durationSeconds || 0);
    return (a.title || '').localeCompare(b.title || '', 'nb');
  });

  return products;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  const buttons = [];

  buttons.push(`
    <button type="button" class="page-btn ${currentPage === 1 ? 'is-disabled' : ''}" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>
      Forrige
    </button>
  `);

  for (let page = 1; page <= totalPages; page++) {
    buttons.push(`
      <button type="button" class="page-btn ${page === currentPage ? 'is-active' : ''}" data-page="${page}">
        ${page}
      </button>
    `);
  }

  buttons.push(`
    <button type="button" class="page-btn ${currentPage === totalPages ? 'is-disabled' : ''}" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>
      Neste
    </button>
  `);

  paginationEl.innerHTML = buttons.join('');

  paginationEl.querySelectorAll('.page-btn').forEach(button => {
    button.addEventListener('click', () => {
      const targetPage = button.dataset.page;
      if (!targetPage) return;

      if (targetPage === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (targetPage === 'next') {
        currentPage = Math.min(totalPages, currentPage + 1);
      } else {
        currentPage = Number(targetPage);
      }

      renderProducts();
    });
  });
}

function renderProducts() {
  const products = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  if (!products.length) {
    inventoryEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    paginationEl.innerHTML = '';
    return;
  }

  emptyStateEl.style.display = 'none';

  const startIndex = (currentPage - 1) * pageSize;
  const visibleProducts = products.slice(startIndex, startIndex + pageSize);

  inventoryEl.innerHTML = visibleProducts.map(product => `
    <article class="score-card">
      <div class="meta">
        <span>${escapeHtml(product.genre || 'Original')}</span>
        <span>${escapeHtml(formatTimeLabel(product.time))}</span>
      </div>
      <h3>${escapeHtml(product.title || 'Uten tittel')}</h3>
      <div class="composer">${escapeHtml(product.composer || 'Ukjent komponist')}</div>

      <div class="pill-row">
        <span class="pill">${escapeHtml(product.ensemble || 'Ukjent besetning')}</span>
      </div>

      <div class="price-row">
        <div class="price"> </div>
        <div class="purchase-actions">
          <a class="buy-btn ${product.previewUrl ? '' : 'is-empty'}" href="${product.previewUrl ? escapeAttribute(product.previewUrl) : '#'}" target="${product.previewUrl ? '_blank' : ''}" rel="${product.previewUrl ? 'noopener noreferrer' : ''}" aria-disabled="${product.previewUrl ? 'false' : 'true'}" ${product.previewUrl ? '' : 'tabindex="-1"'}>
            <span aria-hidden="true">📄</span>
            <span>Vis</span>
          </a>
          <a class="buy-btn ${product.audioUrl ? '' : 'is-empty'}" href="${product.audioUrl ? escapeAttribute(product.audioUrl) : '#'}" target="${product.audioUrl ? '_blank' : ''}" rel="${product.audioUrl ? 'noopener noreferrer' : ''}" aria-disabled="${product.audioUrl ? 'false' : 'true'}" ${product.audioUrl ? '' : 'tabindex="-1"'}>
            <span aria-hidden="true">▶</span>
            <span>Lytt</span>
          </a>
          <a class="buy-btn ${product.buyUrl ? '' : 'is-empty'}" href="${product.buyUrl ? escapeAttribute(product.buyUrl) : '#'}" target="${product.buyUrl ? '_blank' : ''}" rel="${product.buyUrl ? 'noopener noreferrer' : ''}" aria-disabled="${product.buyUrl ? 'false' : 'true'}" ${product.buyUrl ? '' : 'tabindex="-1"'}>
            <span aria-hidden="true">🛒</span>
            <span>Kjøp</span>
          </a>
        </div>
      </div>
    </article>
  `).join('');

  renderPagination(totalPages);
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

searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderProducts();
});

sortSelect.addEventListener('change', () => {
  currentPage = 1;
  renderProducts();
});

window.scoreProducts = [];
loadProducts();
