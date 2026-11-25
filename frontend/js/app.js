/**
 * AI STOCK PREDICTION SYSTEM
 * Professional Stock Analytics Platform Controller
 */

// Application State
const appState = {
  currentSymbol: 'RELIANCE.NS',
  currentPeriod: '1y',
  activeSection: 'dashboard',
  activeSeries: 'Close',
  showSMA: true,
  data: null,
  stocks: [],
  charts: {},
  selectedSectorFilter: 'all'
};

// Dynamic Base URL Detection
function getApiBaseUrl() {
  if (window.location.protocol === 'http:' && window.location.port === '5000') {
    return '';
  }
  const host = (window.location.hostname && window.location.hostname !== '' && window.location.hostname !== 'localhost')
    ? window.location.hostname
    : '127.0.0.1';
  return `http://${host}:5000`;
}

// Resilient API fetcher with multi-endpoint fallback and retry
async function smartFetchJson(path, retries = 3, delayMs = 600) {
  const candidates = [
    `http://127.0.0.1:5000${path}`,
    `http://localhost:5000${path}`,
    path
  ];

  const uniqueUrls = [...new Set(candidates)];
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const url of uniqueUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          return json;
        } else {
          try {
            const errJson = await res.json();
            if (errJson && errJson.status) {
              return errJson;
            }
          } catch (parseErr) {}
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError || new Error(`Failed to fetch from ${path}`);
}

// Update Download Links for CSV & Notebook dynamically
function updateDownloadLinks(symbol, period) {
  const sym = symbol || appState.currentSymbol;
  const per = period || appState.currentPeriod;
  const base = getApiBaseUrl();
  const csvUrl = `${base}/api/download-csv?symbol=${encodeURIComponent(sym)}&period=${encodeURIComponent(per)}`;
  const nbUrl = `${base}/api/download-notebook`;

  const topCsv = document.getElementById('topbar-csv-btn');
  if (topCsv) topCsv.href = csvUrl;

  const reportsCsv = document.getElementById('reports-download-csv-btn');
  if (reportsCsv) reportsCsv.href = csvUrl;

  document.querySelectorAll('a[href*="download-notebook"]').forEach(a => {
    a.href = nbUrl;
  });
}

function showConnectionError(msg) {
  let banner = document.getElementById('conn-error-banner');
  if (!banner) {
    const container = document.querySelector('.content-wrapper');
    if (container) {
      banner = document.createElement('div');
      banner.id = 'conn-error-banner';
      banner.style.cssText = 'margin-bottom: 20px; padding: 14px 18px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #f87171; font-size: 0.88rem;">
          <span style="font-size: 1.15rem;">⚠️</span>
          <span id="conn-error-text">${msg}</span>
        </div>
        <button id="retry-conn-btn" class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; border-color: #f87171; color: #f87171; cursor: pointer;">
          Retry Connection
        </button>
      `;
      container.prepend(banner);
      const retryBtn = document.getElementById('retry-conn-btn');
      if (retryBtn) {
        retryBtn.onclick = async () => {
          retryBtn.innerText = 'Connecting...';
          await loadStocksList();
          await fetchStockData();
          retryBtn.innerText = 'Retry Connection';
        };
      }
    }
  } else {
    banner.style.display = 'flex';
    const textEl = document.getElementById('conn-error-text');
    if (textEl) textEl.innerText = msg;
  }
}

function hideConnectionError() {
  const banner = document.getElementById('conn-error-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupLogin();
  setupNavigation();
  setupSeriesSelector();
  setupPeriodSelector();
  setupSmaToggle();
  setupExploreSectorFilter();
  updateDownloadLinks();

  // Check session persistence
  const isAuthenticated = sessionStorage.getItem('stock_app_auth') === 'true';
  const savedUserName = sessionStorage.getItem('stock_user_name') || 'Guest Analyst';

  if (isAuthenticated) {
    const overlay = document.getElementById('opening-animation');
    if (overlay) overlay.style.display = 'none';
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) loginOverlay.classList.add('hidden');
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'flex';
    const userDisplayName = document.getElementById('user-display-name');
    if (userDisplayName) userDisplayName.innerText = savedUserName;

    await loadStocksList();
    await fetchStockData();
  } else {
    initOpeningAnimation();
    await loadStocksList();
    await fetchStockData();
  }
});

// Opening Animation Controller (3.5s max, skippable, high-fps canvas spline)
let animFrameId = null;
let animTimeout = null;

function initOpeningAnimation() {
  const overlay = document.getElementById('opening-animation');
  const loginOverlay = document.getElementById('login-overlay');
  const skipBtn = document.getElementById('skip-anim-btn');
  const canvas = document.getElementById('anim-chart-canvas');

  if (!overlay) return;

  function finishAnimation() {
    if (animTimeout) clearTimeout(animTimeout);
    if (animFrameId) cancelAnimationFrame(animFrameId);
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.style.display = 'none';
      if (loginOverlay && sessionStorage.getItem('stock_app_auth') !== 'true') {
        loginOverlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }
    }, 500);
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', finishAnimation);
  }

  // Auto transition after 3.5 seconds
  animTimeout = setTimeout(finishAnimation, 3500);

  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Generate smooth random walk stock trajectory with upward trend
  const pointsCount = 60;
  const points = [];
  let currentVal = 100;
  for (let i = 0; i < pointsCount; i++) {
    currentVal += (Math.random() - 0.42) * 6;
    points.push(currentVal);
  }

  const startTime = performance.now();
  const animDuration = 3200;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / animDuration, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const paddingTop = h * 0.28;
    const paddingBottom = h * 0.22;
    const chartHeight = h - paddingTop - paddingBottom;

    const minVal = Math.min(...points) * 0.95;
    const maxVal = Math.max(...points) * 1.05;
    const range = maxVal - minVal || 1;

    const visibleCount = Math.floor(pointsCount * progress);
    if (visibleCount > 1) {
      const stepX = w / (pointsCount - 1);

      // Subtle candlestick shadows
      ctx.lineWidth = 1;
      for (let i = 0; i < visibleCount; i += 2) {
        const x = i * stepX;
        const val = points[i];
        const y = h - paddingBottom - ((val - minVal) / range) * chartHeight;
        const candleHeight = 14 + Math.sin(i * 0.6) * 8;
        const isGreen = i % 4 !== 0;

        ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(x - 3, y - candleHeight / 2, 6, candleHeight);
        ctx.beginPath();
        ctx.moveTo(x, y - candleHeight);
        ctx.lineTo(x, y + candleHeight);
        ctx.stroke();
      }

      // Smooth Spline
      ctx.beginPath();
      ctx.moveTo(0, h - paddingBottom - ((points[0] - minVal) / range) * chartHeight);

      for (let i = 1; i < visibleCount; i++) {
        const xPrev = (i - 1) * stepX;
        const yPrev = h - paddingBottom - ((points[i - 1] - minVal) / range) * chartHeight;
        const xCurr = i * stepX;
        const yCurr = h - paddingBottom - ((points[i] - minVal) / range) * chartHeight;
        const cpX = (xPrev + xCurr) / 2;
        ctx.bezierCurveTo(cpX, yPrev, cpX, yCurr, xCurr, yCurr);
      }

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.7)';
      ctx.shadowBlur = 18;
      ctx.stroke();

      // Area fill underneath
      const lastX = (visibleCount - 1) * stepX;
      const lastY = h - paddingBottom - ((points[visibleCount - 1] - minVal) / range) * chartHeight;

      ctx.lineTo(lastX, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, paddingTop, 0, h);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.14)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      ctx.fillStyle = grad;
      ctx.shadowBlur = 0;
      ctx.fill();

      // Pulsing leading dot
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 20;
      ctx.fill();
    }

    if (progress < 1) {
      animFrameId = requestAnimationFrame(animate);
    }
  }

  animFrameId = requestAnimationFrame(animate);
}

// Authentication & Login Page Controller
function setupLogin() {
  const loginForm = document.getElementById('login-form');
  const guestBtn = document.getElementById('btn-guest-submit');
  const logoutBtn = document.getElementById('btn-logout');
  const loginOverlay = document.getElementById('login-overlay');
  const appContainer = document.querySelector('.app-container');
  const userDisplayName = document.getElementById('user-display-name');

  async function enterApp(name) {
    sessionStorage.setItem('stock_app_auth', 'true');
    sessionStorage.setItem('stock_user_name', name);

    if (userDisplayName) {
      userDisplayName.innerText = name;
    }
    if (loginOverlay) {
      loginOverlay.classList.add('hidden');
    }
    if (appContainer) {
      appContainer.style.display = 'flex';
    }
    switchSection('dashboard');
    updateDownloadLinks();

    if (!appState.data) {
      await fetchStockData();
    }

    setTimeout(() => {
      renderMainChart();
      if (window.lucide) lucide.createIcons();
    }, 120);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('login-email');
      let name = 'Senior Analyst';
      if (emailInput && emailInput.value) {
        const prefix = emailInput.value.split('@')[0];
        name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
      enterApp(name);
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      enterApp('Guest Analyst');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('stock_app_auth');
      sessionStorage.removeItem('stock_user_name');
      if (appContainer) {
        appContainer.style.display = 'none';
      }
      if (loginOverlay) {
        loginOverlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }
    });
  }
}

// Setup Main Navigation (6 Sections)
function setupNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSection = item.getAttribute('data-section');
      switchSection(targetSection);
    });
  });
}

function switchSection(sectionId) {
  if (!sectionId) return;
  appState.activeSection = sectionId;

  // Update active states on sidebar items
  document.querySelectorAll('.menu-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-section') === sectionId);
  });

  // Toggle sections
  document.querySelectorAll('.app-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${sectionId}`);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Re-render components on tab switch to ensure correct dimensions
  if (sectionId === 'dashboard') {
    setTimeout(renderMainChart, 80);
  } else if (sectionId === 'explore') {
    renderExploreStocks();
  } else if (sectionId === 'analysis') {
    setTimeout(renderAnalysisCharts, 80);
  }

  if (window.lucide) lucide.createIcons();
}

// Setup Series Selector on Main Chart
function setupSeriesSelector() {
  const btns = document.querySelectorAll('.series-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.activeSeries = btn.getAttribute('data-series');
      renderMainChart();
    });
  });
}

// Toggle SMA 20 Overlay on Main Chart
function setupSmaToggle() {
  const btn = document.getElementById('toggle-sma-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      appState.showSMA = !appState.showSMA;
      btn.innerHTML = `<i data-lucide="activity" style="width: 13px; height: 13px;"></i> <span>SMA 20: ${appState.showSMA ? 'ON' : 'OFF'}</span>`;
      if (appState.showSMA) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-accent');
      } else {
        btn.classList.remove('btn-accent');
        btn.classList.add('btn-outline');
      }
      if (window.lucide) lucide.createIcons();
      renderMainChart();
    });
  }
}

// Setup Period Filter Pills
function setupPeriodSelector() {
  const periodPills = document.querySelectorAll('.period-pill');
  periodPills.forEach(pill => {
    pill.addEventListener('click', async () => {
      periodPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.currentPeriod = pill.getAttribute('data-period');
      await fetchStockData();
    });
  });
}

// Sector Filter for Explore Stocks Page
function setupExploreSectorFilter() {
  document.querySelectorAll('.sector-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sector-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.selectedSectorFilter = pill.getAttribute('data-sector');
      renderExploreStocks();
    });
  });
}

// Fetch supported Indian stocks list with live/cached market data
async function loadStocksList() {
  try {
    const json = await smartFetchJson('/api/stocks', 3, 600);
    if (json && json.status === 'success' && json.stocks) {
      appState.stocks = json.stocks;

      // Update topbar select dropdown
      const selectEl = document.getElementById('stock-select-input');
      if (selectEl) {
        selectEl.innerHTML = json.stocks.map(s => `
          <option value="${s.symbol}" ${s.symbol === appState.currentSymbol ? 'selected' : ''}>
            ${s.name} (${s.symbol})
          </option>
        `).join('');

        selectEl.addEventListener('change', async (e) => {
          await selectStock(e.target.value);
        });
      }

      // Render Explore Stocks cards
      renderExploreStocks();
    }
  } catch (err) {
    console.warn('Error loading stocks list:', err);
  }
}

// Select stock and reload data across the platform
async function selectStock(symbol) {
  if (!symbol) return;
  appState.currentSymbol = symbol;

  const selectEl = document.getElementById('stock-select-input');
  if (selectEl) selectEl.value = symbol;

  updateDownloadLinks();
  renderExploreStocks();
  await fetchStockData();
  switchSection('dashboard');
}

// Render Explore Stocks Cards Grid
function renderExploreStocks() {
  const container = document.getElementById('explore-stocks-grid');
  if (!container || !appState.stocks.length) return;

  const filter = appState.selectedSectorFilter.toLowerCase();
  const filtered = appState.stocks.filter(s => {
    if (filter === 'all') return true;
    return s.sector.toLowerCase().includes(filter);
  });

  container.innerHTML = filtered.map(s => {
    const isActive = s.symbol === appState.currentSymbol;
    const isUp = (s.daily_change || 0) >= 0;
    const priceFormatted = s.current_price != null 
      ? `₹${Number(s.current_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '₹---';
    const changeFormatted = s.daily_change != null
      ? `${isUp ? '+' : ''}₹${Number(s.daily_change).toFixed(2)} (${isUp ? '+' : ''}${Number(s.daily_change_pct).toFixed(2)}%)`
      : '---';

    return `
      <div class="stock-card ${isActive ? 'active-card' : ''}" onclick="selectStock('${s.symbol}')">
        <div class="stock-card-top">
          <div>
            <div class="stock-card-symbol">${s.symbol}</div>
            <div class="stock-card-name">${s.name}</div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="market-chip market-chip-sector" style="font-size: 0.65rem;">${s.sector.split('/')[0].trim()}</span>
            ${isActive ? '<span class="stock-card-active-badge">Active</span>' : ''}
          </div>
        </div>

        <div class="stock-card-price-row">
          <div class="stock-card-price">${priceFormatted}</div>
          <span class="price-change-pill ${isUp ? 'price-up' : 'price-down'}" style="font-size: 0.75rem; padding: 3px 8px;">
            <i data-lucide="${isUp ? 'trending-up' : 'trending-down'}" style="width: 12px; height: 12px;"></i>
            <span>${changeFormatted}</span>
          </span>
        </div>

        <div class="stock-card-metrics">
          <div>
            <div class="stock-card-metric-label">Volume (24h)</div>
            <div class="stock-card-metric-val">${s.latest_volume ? formatVolume(s.latest_volume) : '---'}</div>
          </div>
          <div>
            <div class="stock-card-metric-label">52W Range</div>
            <div class="stock-card-metric-val">
              ${s.low_52w ? `₹${Math.round(s.low_52w)} - ₹${Math.round(s.high_52w)}` : '---'}
            </div>
          </div>
        </div>

        <div class="stock-card-action">
          <span>${isActive ? 'Currently Analyzing' : 'Click to Analyze'}</span>
          <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Fetch stock data from backend API
async function fetchStockData() {
  showLoading(true);
  let json = null;
  try {
    const path = `/api/analyze?symbol=${encodeURIComponent(appState.currentSymbol)}&period=${appState.currentPeriod}`;
    json = await smartFetchJson(path, 3, 1000);
  } catch (err) {
    console.error('Data fetch error:', err);
    showConnectionError('Unable to connect to Flask backend. Please verify python app.py is running on port 5000.');
    showLoading(false);
    return;
  }

  try {
    if (json && json.status === 'success' && json.data) {
      appState.data = json.data;
      hideConnectionError();
      updateUI();
    } else {
      console.warn('Backend returned non-success:', json);
      showConnectionError((json && json.message) ? json.message : 'Unable to fetch data from Yahoo Finance. Please try again.');
    }
  } catch (renderErr) {
    console.error('Error rendering stock data in UI:', renderErr);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.style.opacity = show ? '1' : '0';
    loader.style.pointerEvents = show ? 'all' : 'none';
  }
}

// Master UI Update
function updateUI() {
  if (!appState.data) return;
  const d = appState.data;

  // Update CSV and Notebook Download Links
  updateDownloadLinks(d.symbol, appState.currentPeriod);

  // 1. Dashboard View
  updateDashboard(d);

  // 2. Explore Stocks Active Card Refresh
  renderExploreStocks();

  // 3. Market Analysis View
  renderAnalysisCharts();

  // 4. Technical Insights View
  updateTechnicalInsights(d);

  // 5. Data & Reports View
  updateDataAndReports(d);

  if (window.lucide) lucide.createIcons();
}

// 1. Dashboard Update
function updateDashboard(d) {
  const sum = d.eda.summary;

  document.getElementById('dash-company-name').innerText = d.company_name;
  document.getElementById('dash-stock-ticker').innerText = d.symbol;
  document.getElementById('dash-current-price').innerText = `₹${sum.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Sector lookup
  const stockMeta = appState.stocks.find(s => s.symbol === d.symbol);
  if (stockMeta) {
    document.getElementById('dash-stock-sector').innerText = stockMeta.sector;
  }

  // Daily change badge
  const changePill = document.getElementById('dash-price-change');
  const isUp = sum.daily_change >= 0;
  changePill.className = `price-change-pill ${isUp ? 'price-up' : 'price-down'}`;
  changePill.innerHTML = `
    <i data-lucide="${isUp ? 'trending-up' : 'trending-down'}" style="width: 13px; height: 13px;"></i>
    <span>${isUp ? '+' : ''}₹${sum.daily_change.toFixed(2)} (${isUp ? '+' : ''}${sum.daily_change_pct.toFixed(2)}%)</span>
  `;

  // Mini stats
  document.getElementById('dash-volume').innerText = formatVolume(sum.latest_volume);
  document.getElementById('dash-52w-high').innerText = `₹${sum.high_52w.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('dash-52w-low').innerText = `₹${sum.low_52w.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('dash-avg-price').innerText = `₹${sum.avg_close.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('dash-last-updated').innerText = sum.last_updated;

  // Status metrics
  document.getElementById('dash-records-count').innerText = `${d.metadata.total_records} Sessions`;
  document.getElementById('dash-date-span').innerText = `${d.metadata.start_date} to ${d.metadata.end_date}`;

  renderMainChart();
}

function formatVolume(val) {
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)} Cr`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString();
}

// Render Main Interactive Stock Chart
function renderMainChart() {
  if (!appState.data || !appState.data.charts) return;
  const c = appState.data.charts;
  const ctx = document.getElementById('main-interactive-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (appState.charts.main) appState.charts.main.destroy();

  const seriesKey = appState.activeSeries.toLowerCase();
  let seriesData = [];
  let seriesLabel = `${appState.activeSeries} Price (₹)`;
  let isVolume = seriesKey === 'volume';

  if (seriesKey === 'close') seriesData = c.closes;
  else if (seriesKey === 'open') seriesData = c.opens;
  else if (seriesKey === 'high') seriesData = c.highs;
  else if (seriesKey === 'low') seriesData = c.lows;
  else if (seriesKey === 'volume') {
    seriesData = c.volumes;
    seriesLabel = 'Volume (Shares)';
  }

  const datasets = [
    {
      label: seriesLabel,
      data: seriesData,
      type: isVolume ? 'bar' : 'line',
      borderColor: isVolume ? '#8b5cf6' : '#06b6d4',
      backgroundColor: isVolume ? 'rgba(139, 92, 246, 0.5)' : 'rgba(6, 182, 212, 0.08)',
      borderWidth: 2,
      fill: !isVolume,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 6,
      borderRadius: isVolume ? 3 : 0
    }
  ];

  // Overlay SMA 20 if enabled and not viewing volume
  if (appState.showSMA && !isVolume) {
    datasets.push({
      label: 'SMA 20 (₹)',
      data: c.sma20,
      type: 'line',
      borderColor: '#f59e0b',
      borderWidth: 1.6,
      borderDash: [5, 5],
      fill: false,
      tension: 0.1,
      pointRadius: 0
    });
  }

  appState.charts.main = new Chart(ctx, {
    data: {
      labels: c.dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } } },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.label.includes('Volume')) {
                return `${item.dataset.label}: ${Number(item.raw).toLocaleString()} shares`;
              }
              return `${item.dataset.label}: ₹${Number(item.raw).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 12 },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            callback: (val) => isVolume ? formatVolume(val) : `₹${val.toLocaleString('en-IN')}`
          },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        }
      }
    }
  });
}

// 3. Market Analysis Visualizations (3 focused visualizations)
function renderAnalysisCharts() {
  if (!appState.data || !appState.data.charts || typeof Chart === 'undefined') return;
  const c = appState.data.charts;

  // Visualization 1: Price Trend (Close vs SMA 20 in ₹)
  renderLineChart('chart-eda-close', c.dates, [
    { label: 'Close Price (₹)', data: c.closes, borderColor: '#06b6d4', bg: 'rgba(6,182,212,0.06)' },
    { label: 'SMA 20 (₹)', data: c.sma20, borderColor: '#f59e0b', dash: [5, 5] }
  ]);

  // Visualization 2: Trading Activity (Volume over time)
  renderBarChart('chart-eda-volume', c.dates, c.volumes, 'rgba(139,92,246,0.5)', '#8b5cf6');

  // Visualization 3: Feature Correlation Heatmap
  renderHeatmap(appState.data.eda.correlation_matrix);

  // Dynamic analytical observations
  if (appState.data.eda && appState.data.eda.observations) {
    const obs = appState.data.eda.observations;
    const obsClose = document.getElementById('obs-text-close');
    const obsVol = document.getElementById('obs-text-volume');
    const obsCorr = document.getElementById('obs-text-corr');
    if (obsClose && obs.closing_price) obsClose.innerText = obs.closing_price;
    if (obsVol && obs.volume) obsVol.innerText = obs.volume;
    if (obsCorr && obs.correlation) obsCorr.innerText = obs.correlation;
  }
}

function renderLineChart(canvasId, labels, datasetsConfig) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (appState.charts[canvasId]) appState.charts[canvasId].destroy();

  const datasets = datasetsConfig.map(cfg => ({
    label: cfg.label,
    data: cfg.data,
    borderColor: cfg.borderColor,
    backgroundColor: cfg.bg || 'transparent',
    borderWidth: 2,
    borderDash: cfg.dash || [],
    fill: !!cfg.bg,
    tension: 0.15,
    pointRadius: 0
  }));

  appState.charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ₹${Number(item.raw).toLocaleString('en-IN', {minimumFractionDigits: 2})}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          ticks: { color: '#64748b', callback: (val) => `₹${val.toLocaleString('en-IN')}` },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        }
      }
    }
  });
}

function renderBarChart(canvasId, labels, data, bgColor, borderColor) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (appState.charts[canvasId]) appState.charts[canvasId].destroy();

  appState.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume (Shares)',
        data,
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          ticks: { color: '#64748b', callback: (val) => formatVolume(val) },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        }
      }
    }
  });
}

function renderHeatmap(matrix) {
  const container = document.getElementById('heatmap-view-box');
  if (!container || !matrix) return;
  const cols = Object.keys(matrix);

  let html = '<table class="heatmap-table"><thead><tr><th>Feature</th>';
  cols.forEach(c => html += `<th>${c}</th>`);
  html += '</tr></thead><tbody>';

  cols.forEach(r => {
    html += `<tr><td style="text-align: left; font-weight: 600; color: #94a3b8;">${r}</td>`;
    cols.forEach(c => {
      const val = matrix[r][c];
      const opacity = Math.abs(val);
      const bg = val >= 0 
        ? `rgba(6, 182, 212, ${opacity * 0.7})` 
        : `rgba(239, 68, 68, ${opacity * 0.7})`;
      html += `<td style="background: ${bg}; color: #ffffff;">${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 4. Technical Insights Update (5 Useful Indicators + Signals)
function updateTechnicalInsights(d) {
  const container = document.getElementById('features-cards-container');
  if (container && d.feature_engineering.features_summary) {
    const coreKeys = ['SMA_20', 'EMA_20', 'RSI', 'Daily_Return', 'Price_Change'];
    const coreFeats = d.feature_engineering.features_summary.filter(f => coreKeys.includes(f.key));
    
    container.innerHTML = coreFeats.map(feat => `
      <div class="glass-panel" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #38bdf8;">${feat.name}</div>
            <span class="market-chip market-chip-sector" style="font-size: 0.65rem;">${feat.category}</span>
          </div>
          <div class="font-mono" style="font-size: 1.15rem; font-weight: 800; color: #ffffff;">
            ${feat.latest_value}
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.7rem; color: #a855f7; margin-bottom: 6px;">
          Formula: ${feat.formula}
        </div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45;">${feat.description}</p>
      </div>
    `).join('');

    // Dynamic Signal Interpretation
    const curPrice = d.eda.summary.current_price;
    const smaFeat = coreFeats.find(f => f.key === 'SMA_20');
    const rsiFeat = coreFeats.find(f => f.key === 'RSI');
    const priceChgFeat = coreFeats.find(f => f.key === 'Price_Change');

    // Trend Bias
    const trendEl = document.getElementById('signal-trend-bias');
    const trendDesc = document.getElementById('signal-trend-desc');
    if (trendEl && smaFeat) {
      const smaVal = parseFloat(smaFeat.latest_value.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(smaVal)) {
        if (curPrice >= smaVal) {
          trendEl.innerText = 'Bullish (Price ≥ SMA 20)';
          trendEl.style.color = '#10b981';
          if (trendDesc) trendDesc.innerText = `Current price ₹${curPrice.toFixed(2)} is trading above its 20-day average of ₹${smaVal.toFixed(2)}, indicating upward trend alignment.`;
        } else {
          trendEl.innerText = 'Bearish (Price < SMA 20)';
          trendEl.style.color = '#ef4444';
          if (trendDesc) trendDesc.innerText = `Current price ₹${curPrice.toFixed(2)} is trading below its 20-day average of ₹${smaVal.toFixed(2)}, indicating downward or consolidation pressure.`;
        }
      }
    }

    // Momentum State (RSI)
    const momEl = document.getElementById('signal-momentum-state');
    const momDesc = document.getElementById('signal-momentum-desc');
    if (momEl && rsiFeat) {
      const rsiVal = parseFloat(rsiFeat.latest_value);
      if (!isNaN(rsiVal)) {
        if (rsiVal >= 70) {
          momEl.innerText = `Overbought (${rsiVal.toFixed(1)})`;
          momEl.style.color = '#ef4444';
          if (momDesc) momDesc.innerText = `RSI is above 70, reflecting high buying momentum and potential short-term pullback risk.`;
        } else if (rsiVal <= 30) {
          momEl.innerText = `Oversold (${rsiVal.toFixed(1)})`;
          momEl.style.color = '#10b981';
          if (momDesc) momDesc.innerText = `RSI is below 30, reflecting extended selling pressure and potential oversold bounce conditions.`;
        } else {
          momEl.innerText = `Neutral Momentum (${rsiVal.toFixed(1)})`;
          momEl.style.color = '#38bdf8';
          if (momDesc) momDesc.innerText = `RSI is balanced within the 30–70 channel without extreme overbought or oversold exhaustion.`;
        }
      }
    }

    // Intraday Movement
    const intraEl = document.getElementById('signal-intraday-state');
    const intraDesc = document.getElementById('signal-intraday-desc');
    if (intraEl && priceChgFeat) {
      const chgVal = parseFloat(priceChgFeat.latest_value.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(chgVal)) {
        if (chgVal >= 0) {
          intraEl.innerText = `Positive Intraday (+₹${chgVal.toFixed(2)})`;
          intraEl.style.color = '#10b981';
          if (intraDesc) intraDesc.innerText = `Asset closed higher than its opening price during the latest session.`;
        } else {
          intraEl.innerText = `Negative Intraday (₹${chgVal.toFixed(2)})`;
          intraEl.style.color = '#ef4444';
          if (intraDesc) intraDesc.innerText = `Asset closed lower than its opening price during the latest session.`;
        }
      }
    }
  }
}

// 5. Data & Reports Update
function updateDataAndReports(d) {
  const stockEl = document.getElementById('reports-selected-stock');
  if (stockEl) stockEl.innerText = d.symbol;

  const finalRowsCount = document.getElementById('final-rows-count');
  const finalColsCount = document.getElementById('final-cols-count');
  if (finalRowsCount && d.final_dataset) finalRowsCount.innerText = d.final_dataset.total_records;
  if (finalColsCount && d.final_dataset) finalColsCount.innerText = d.final_dataset.columns.length;

  // Processed Dataset Preview Table (13 Columns)
  const rows = document.getElementById('final-dataset-rows');
  if (rows && d.final_dataset && d.final_dataset.preview) {
    rows.innerHTML = d.final_dataset.preview.slice(-10).map(r => `
      <tr>
        <td>${r.Date || '-'}</td>
        <td class="inr-val">₹${r.Open != null ? Number(r.Open).toFixed(2) : '-'}</td>
        <td class="inr-val">₹${r.High != null ? Number(r.High).toFixed(2) : '-'}</td>
        <td class="inr-val">₹${r.Low != null ? Number(r.Low).toFixed(2) : '-'}</td>
        <td class="inr-val">₹${r.Close != null ? Number(r.Close).toFixed(2) : '-'}</td>
        <td class="font-mono">${r.Volume != null ? Number(r.Volume).toLocaleString() : '-'}</td>
        <td class="font-mono" style="color: ${r.Price_Change >= 0 ? '#10b981' : '#ef4444'};">
          ${r.Price_Change != null ? (r.Price_Change >= 0 ? '+' : '') + '₹' + Number(r.Price_Change).toFixed(2) : '-'}
        </td>
        <td class="inr-val" style="color: #a855f7;">₹${r.Price_Spread != null ? Number(r.Price_Spread).toFixed(2) : '-'}</td>
        <td class="inr-val">₹${r.SMA_20 != null ? Number(r.SMA_20).toFixed(2) : '-'}</td>
        <td class="inr-val">₹${r.EMA_20 != null ? Number(r.EMA_20).toFixed(2) : '-'}</td>
        <td class="font-mono" style="color: ${r.Daily_Return >= 0 ? '#10b981' : '#ef4444'};">
          ${r.Daily_Return != null ? (r.Daily_Return >= 0 ? '+' : '') + (Number(r.Daily_Return) * 100).toFixed(2) + '%' : '-'}
        </td>
        <td class="font-mono" style="color: ${r.RSI > 70 ? '#ef4444' : r.RSI < 30 ? '#10b981' : '#38bdf8'};">
          ${r.RSI != null ? Number(r.RSI).toFixed(2) : '-'}
        </td>
        <td class="inr-val" style="color: #ec4899; font-weight: 700;">
          ₹${r.Next_Day_Close != null ? Number(r.Next_Day_Close).toFixed(2) : '-'}
        </td>
      </tr>
    `).join('');
  }

  // Schema & Attribute Definitions
  const dictRows = document.getElementById('reports-dictionary-rows');
  if (dictRows && d.description && d.description.dictionary) {
    dictRows.innerHTML = d.description.dictionary.map(item => `
      <tr>
        <td class="font-mono" style="color: #38bdf8; font-weight: 600;">${item.column}</td>
        <td>${item.description}</td>
        <td><span class="market-chip market-chip-nse">${item.dtype}</span></td>
        <td style="color: #10b981; font-weight: 600;">${item.unit}</td>
      </tr>
    `).join('');
  }
}
