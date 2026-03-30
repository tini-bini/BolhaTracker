(function initBolhaPricePanel() {
  'use strict';

  const {
    MESSAGE_TYPES,
    STATUS_META,
    DONATION_URL,
    isLikelyListingUrl,
    isBolhaUrl,
    extractListingFromDocument,
    buildSparklinePath,
    getPriceSeries,
    formatCurrency,
    findTrackedListingByUrl
  } = globalThis.BolhaTrackerUtils;

  const {
    getMessage,
    resolveLocale,
    getStatusShortLabel,
    formatRelativeTime,
    getPriceDifferenceSummary
  } = globalThis.BolhaTrackerI18n;

  // Only activate on listing pages
  const pageUrl = window.location.href;
  if (!isBolhaUrl(pageUrl) || !isLikelyListingUrl(pageUrl)) return;

  // Prevent double-init (e.g. from SPA navigation)
  if (document.getElementById('bolha-tracker-host')) return;

  // ── State ──────────────────────────────────────────────────────────────────
  const THEME_KEY = 'bolha_tracker_theme';

  const state = {
    locale: 'auto',
    theme: 'dark',
    listing: null,
    trackedItem: null,
    loading: true,
    minimized: false,
    refreshing: false,
    closed: false,
    notice: ''
  };

  let noticeTimer = null;

  function applyTheme(theme) {
    state.theme = theme || 'dark';
    host.setAttribute('data-theme', state.theme);
  }

  function t(key, subs) {
    return getMessage(key, resolveLocale(state.locale), subs);
  }

  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showNotice(message) {
    state.notice = message || '';
    render();
    rebindDrag();

    if (noticeTimer) {
      clearTimeout(noticeTimer);
    }

    if (!message) return;

    noticeTimer = setTimeout(() => {
      state.notice = '';
      render();
      rebindDrag();
    }, 2200);
  }

  // ── Saved position/size ────────────────────────────────────────────────────
  const UI_KEY = 'bolha_tracker_panel_ui';

  function loadUiState() {
    try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; }
  }

  function saveUiState(patch) {
    try {
      const prev = loadUiState();
      localStorage.setItem(UI_KEY, JSON.stringify({ ...prev, ...patch }));
    } catch {}
  }

  // ── Shadow DOM ─────────────────────────────────────────────────────────────
  // Fixed full-viewport host — children positioned absolutely within it
  const host = document.createElement('div');
  host.id = 'bolha-tracker-host';
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '2147483647',
    pointerEvents: 'none',
    overflow: 'visible'
  });
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // CSS via <link> into shadow root
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('panel.css');
  shadow.appendChild(styleLink);

  // Panel wrapper — absolutely positioned inside host
  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap';
  shadow.appendChild(wrap);

  // ── Position/size helpers ──────────────────────────────────────────────────
  let posX = null;
  let posY = null;
  let panelW = 280;
  let panelH = null; // null = auto height, number = explicit px

  const MIN_W = 240, MAX_W = 560;
  const MIN_H = 80;

  function initPosition() {
    const saved = loadUiState();
    panelW = Math.max(MIN_W, Math.min(MAX_W, saved.w || 280));
    panelH = typeof saved.h === 'number' ? saved.h : null;
    state.minimized = Boolean(saved.minimized);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    posX = (saved.x != null) ? Math.max(0, Math.min(saved.x, vw - panelW)) : vw - panelW - 20;
    posY = (saved.y != null) ? Math.max(0, Math.min(saved.y, vh - 40)) : null;

    applyPos();
  }

  function applyPos() {
    wrap.style.left = posX + 'px';
    wrap.style.top = (posY !== null ? posY : 0) + 'px';
    wrap.style.width = panelW + 'px';
    if (panelH !== null) {
      wrap.style.height = panelH + 'px';
    } else {
      wrap.style.height = '';
    }
  }

  // Sync wrap height to panel's natural height so handles have a reference
  function syncWrapHeight() {
    if (panelH !== null) return; // already explicit
    const panelEl = wrap.querySelector('.panel');
    if (panelEl) wrap.style.height = panelEl.offsetHeight + 'px';
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    if (state.closed) { wrap.innerHTML = ''; return; }

    const { listing, trackedItem: tracked, loading, minimized, refreshing } = state;

    let bodyHtml = '';

    if (loading) {
      bodyHtml = `
        <div class="loading-state">
          <div class="skel-line w80"></div>
          <div class="skel-line w60"></div>
          <div class="skel-line w45"></div>
        </div>`;
    } else if (!listing || !listing.isListing) {
      bodyHtml = `<div class="p-empty">Tega oglasa na Bolhi ni mogoče spremljati.</div>`;
    } else {
      const unavailable = listing.available === false;
      const isTracked = Boolean(tracked);
      const priceText = unavailable
        ? t('listingUnavailable')
        : (listing.priceText || formatCurrency(listing.currentPrice, listing.currency));

      const status = isTracked ? tracked.status : (unavailable ? 'unavailable' : 'unchanged');
      const tone = (STATUS_META[status] || { tone: 'unchanged' }).tone;
      const statusLabel = getStatusShortLabel(status, resolveLocale(state.locale));

      // Thumbnail
      const thumbHtml = listing.imageUrl
        ? `<img class="p-thumb" src="${esc(listing.imageUrl)}" alt="" loading="lazy">`
        : `<div class="p-thumb p-thumb-fallback">B</div>`;

      // Price delta
      const delta = isTracked ? getPriceDifferenceSummary(tracked, resolveLocale(state.locale)) : '';
      const lastCheck = isTracked && tracked.lastChecked
        ? formatRelativeTime(tracked.lastChecked, resolveLocale(state.locale))
        : '';

      // Sparkline
      let sparkHtml = '';
      if (isTracked) {
        const pts = getPriceSeries(tracked);
        const path = buildSparklinePath(pts, 220, 26);
        if (path) {
          sparkHtml = `
            <div class="p-spark">
              <svg class="sparkline sp-${esc(tone)}" viewBox="0 0 220 26" preserveAspectRatio="none" aria-hidden="true">
                <path d="${esc(path)}"></path>
              </svg>
            </div>`;
        }
      }

      // Action buttons
      let actionsHtml;
      if (isTracked) {
        actionsHtml = `
          <button class="btn btn-secondary" data-action="refresh" ${refreshing ? 'disabled' : ''}>
            ${refreshing ? 'Osvežujem ...' : 'Osveži'}
          </button>
          <button class="btn btn-danger" data-action="remove">Odstrani</button>
          <a class="btn btn-ghost" href="${esc(listing.url)}" target="_blank" rel="noreferrer">Odpri ↗</a>`;
      } else if (unavailable) {
        actionsHtml = `
          <button class="btn btn-secondary" disabled>Ni na voljo</button>
          <a class="btn btn-ghost" href="${esc(listing.url)}" target="_blank" rel="noreferrer">Odpri ↗</a>`;
      } else {
        actionsHtml = `
          <button class="btn btn-primary" data-action="track">Spremljaj ceno</button>
          <a class="btn btn-ghost" href="${esc(listing.url)}" target="_blank" rel="noreferrer">Odpri ↗</a>`;
      }

      bodyHtml = `
        <div class="p-body">
          <div class="p-listing">
            ${thumbHtml}
            <div class="p-info">
              <div class="p-title-row">
                <span class="p-title">${esc(listing.title)}</span>
                <span class="s-pill s-${esc(tone)}">${esc(statusLabel)}</span>
              </div>
              <div class="p-price">${esc(priceText)}</div>
              ${delta ? `<div class="p-delta d-${esc(tone)}">${esc(delta)}</div>` : ''}
              ${lastCheck ? `<div class="p-meta">${esc(lastCheck)}</div>` : ''}
            </div>
          </div>
          ${sparkHtml}
          <div class="p-actions">${actionsHtml}</div>
        </div>`;
    }

    const minimizeIcon = minimized ? '▲' : '▼';
    const themeIcon = state.theme === 'light' ? '☾' : '☀';
    const themeTitle = state.theme === 'light' ? 'Preklopi na temno temo' : 'Preklopi na svetlo temo';

    const handlesHtml = minimized ? '' : `
      <div class="rh rh-n"  data-resize="n"></div>
      <div class="rh rh-s"  data-resize="s"></div>
      <div class="rh rh-e"  data-resize="e"></div>
      <div class="rh rh-w"  data-resize="w"></div>
      <div class="rh rh-ne" data-resize="ne"></div>
      <div class="rh rh-nw" data-resize="nw"></div>
      <div class="rh rh-se" data-resize="se"></div>
      <div class="rh rh-sw" data-resize="sw"></div>`;

    wrap.innerHTML = `
      <div class="panel${minimized ? ' is-minimized' : ''}${panelH !== null ? ' has-height' : ''}">
        <div class="p-header" data-drag>
          <div class="p-header-left">
            <span class="p-logo">B</span>
            <span class="p-brand">Bolha Sledilnik</span>
          </div>
          <div class="p-header-right">
            <button class="btn btn-donate" data-action="donate" title="Podpri razvoj" ${DONATION_URL ? "" : "disabled"}>Podpri</button>
            <button class="btn-theme p-hbtn" data-action="theme" title="${esc(themeTitle)}">${esc(themeIcon)}</button>
            <button class="p-hbtn" data-action="minimize" title="${minimized ? 'Razširi' : 'Strni'}">${minimizeIcon}</button>
            <button class="p-hbtn" data-action="close" title="Zapri">×</button>
          </div>
        </div>
        ${minimized ? '' : bodyHtml}
      </div>
      ${handlesHtml}`;

    // Sync wrap height so handle CSS (bottom/height) works correctly
    requestAnimationFrame(syncWrapHeight);

    bindEvents();
  }

  // ── Event binding ──────────────────────────────────────────────────────────
  function bindEvents() {
    // Action buttons
    wrap.querySelectorAll('[data-action]').forEach(el => {
      if (el.tagName === 'A') return; // links handle themselves
      el.addEventListener('click', handleAction);
    });

    // Drag
    const header = wrap.querySelector('[data-drag]');
    if (header) bindDrag(header);

    // Resize handles (all sides/corners)
    bindAllResizes();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleAction(e) {
    const action = e.currentTarget.dataset.action;
    e.stopPropagation();

    switch (action) {
      case 'minimize': {
        state.minimized = !state.minimized;
        saveUiState({ minimized: state.minimized });
        render();
        rebindDrag();
        break;
      }

      case 'close': {
        state.closed = true;
        render();
        break;
      }

      case 'theme': {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        await chrome.storage.local.set({ [THEME_KEY]: next });
        applyTheme(next);
        render();
        rebindDrag();
        break;
      }

      case 'donate': {
        if (DONATION_URL) {
          window.open(DONATION_URL, '_blank', 'noopener,noreferrer');
        }
        break;
      }

      case 'track': {
        if (!state.listing) break;
        const resp = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.ADD_TRACKED_LISTING,
          payload: state.listing
        });
        if (resp && resp.ok) {
          await reloadTracked();
          render();
          rebindDrag();
        }
        break;
      }

      case 'refresh': {
        if (!state.trackedItem) break;
        state.refreshing = true;
        render();
        rebindDrag();
        try {
          await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.REFRESH_TRACKED_LISTING,
            payload: { id: state.trackedItem.id }
          });
          await reloadTracked();
        } finally {
          state.refreshing = false;
          render();
          rebindDrag();
        }
        break;
      }

      case 'remove': {
        if (!state.trackedItem) break;
        await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.REMOVE_TRACKED_LISTING,
          payload: { id: state.trackedItem.id }
        });
        state.trackedItem = null;
        render();
        rebindDrag();
        break;
      }
    }
  }

  async function reloadTracked() {
    state.trackedItem = (state.listing && state.listing.url)
      ? await findTrackedListingByUrl(state.listing.url)
      : null;
  }

  // ── Drag ───────────────────────────────────────────────────────────────────
  let currentDragCleanup = null;

  function rebindDrag() {
    if (currentDragCleanup) { currentDragCleanup(); currentDragCleanup = null; }
    const header = wrap.querySelector('[data-drag]');
    if (header) bindDrag(header);
  }

  function bindDrag(header) {
    function onMousedown(e) {
      // Ignore clicks on interactive children
      if (e.target !== header && e.target.closest('[data-action], button, a, input')) return;
      e.preventDefault();

      const startMX = e.clientX;
      const startMY = e.clientY;
      const startX = posX;
      const startY = posY !== null ? posY : parseInt(wrap.style.top) || 0;

      function onMove(ev) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        posX = Math.max(0, Math.min(startX + ev.clientX - startMX, vw - panelW));
        posY = Math.max(0, Math.min(startY + ev.clientY - startMY, vh - 40));
        wrap.style.left = posX + 'px';
        wrap.style.top = posY + 'px';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        saveUiState({ x: posX, y: posY });
      }

      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    }

    header.addEventListener('mousedown', onMousedown);
    currentDragCleanup = () => header.removeEventListener('mousedown', onMousedown);
  }

  // ── Resize (all 8 directions) ───────────────────────────────────────────────
  function bindAllResizes() {
    wrap.querySelectorAll('[data-resize]').forEach(handle => {
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();

        const dir = handle.dataset.resize; // n|s|e|w|ne|nw|se|sw
        const startMX = e.clientX;
        const startMY = e.clientY;
        const startW  = panelW;
        const startX  = posX;
        const startY  = posY !== null ? posY : (parseInt(wrap.style.top) || 0);
        // Capture current panel height — use offsetHeight if not yet explicit
        const startH  = panelH !== null ? panelH : (wrap.querySelector('.panel') || {}).offsetHeight || 300;

        function onMove(ev) {
          const dx = ev.clientX - startMX;
          const dy = ev.clientY - startMY;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const maxH = Math.round(vh * 0.92);

          // ── Horizontal ──
          if (dir.includes('e')) {
            panelW = Math.max(MIN_W, Math.min(MAX_W, startW + dx));
            wrap.style.width = panelW + 'px';
          }
          if (dir.includes('w')) {
            const newW = Math.max(MIN_W, Math.min(MAX_W, startW - dx));
            posX = Math.max(0, startX + startW - newW);
            panelW = newW;
            wrap.style.width  = panelW + 'px';
            wrap.style.left   = posX + 'px';
          }

          // ── Vertical ──
          if (dir.includes('s')) {
            panelH = Math.max(MIN_H, Math.min(maxH, startH + dy));
            wrap.style.height = panelH + 'px';
            const panelEl = wrap.querySelector('.panel');
            if (panelEl) panelEl.classList.add('has-height');
          }
          if (dir.includes('n')) {
            const newH = Math.max(MIN_H, Math.min(maxH, startH - dy));
            posY = Math.max(0, startY + startH - newH);
            panelH = newH;
            wrap.style.height = panelH + 'px';
            wrap.style.top    = posY + 'px';
            const panelEl = wrap.querySelector('.panel');
            if (panelEl) panelEl.classList.add('has-height');
          }
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup', onUp, true);
          saveUiState({ x: posX, y: posY, w: panelW, h: panelH });
        }

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
      });
    });
  }

  // ── Bottom-anchoring after first render ────────────────────────────────────
  function anchorToBottomRight() {
    const saved = loadUiState();
    if (saved.y != null) return; // user has moved it, respect that

    const panel = wrap.querySelector('.panel');
    if (!panel) return;

    const h = panel.offsetHeight;
    const vh = window.innerHeight;
    posY = Math.max(20, vh - h - 20);
    wrap.style.top = posY + 'px';
    saveUiState({ y: posY });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    // Load theme
    try {
      const stored = await chrome.storage.local.get(THEME_KEY);
      applyTheme(stored[THEME_KEY] || 'dark');
    } catch { applyTheme('dark'); }

    // Load settings for locale
    try {
      const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
      if (resp && resp.ok) state.locale = resp.settings.locale || 'auto';
    } catch { /* service worker may be inactive, continue */ }

    // Extract listing from current DOM
    try {
      state.listing = extractListingFromDocument(document, pageUrl);
    } catch { state.listing = null; }

    // Check if already tracked
    await reloadTracked();

    state.loading = false;
    render();
    rebindDrag();

    // Place panel flush to bottom-right on first open
    requestAnimationFrame(anchorToBottomRight);

    // Reactively update when tracked listings or theme changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.trackedListings) {
        reloadTracked().then(() => { render(); rebindDrag(); });
      }
      if (changes[THEME_KEY]) {
        applyTheme(changes[THEME_KEY].newValue || 'dark');
        render();
        rebindDrag();
      }
    });
  }

  // Wait for CSS to load before showing — avoids flash of unstyled content
  styleLink.addEventListener('load', () => {
    initPosition();
    init();
  });

  // Init anyway if CSS fails to load (e.g. manifest misconfiguration)
  styleLink.addEventListener('error', () => {
    initPosition();
    init();
  });
})();
