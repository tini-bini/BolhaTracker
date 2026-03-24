const {
  DONATION_URL,
  MESSAGE_TYPES,
  STATUS_META,
  buildSparklinePath,
  findTrackedListingByUrl,
  formatCurrency,
  getPriceSeries,
  getTrackedListings
} = globalThis.BolhaTrackerUtils;

const {
  getMessage,
  formatRelativeTime,
  formatTimeUntil,
  getPriceDifferenceSummary,
  getRecoverySummary,
  getRefreshFrequencyLabel,
  getStatusLabel,
  getStatusShortLabel,
  getStatusSummary,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const currentPageContent = document.getElementById("current-page-content");
const trackedList = document.getElementById("tracked-list");
const summaryGrid = document.getElementById("summary-grid");
const toast = document.getElementById("toast");
const openOptionsButton = document.getElementById("open-options-button");
const donateButton = document.getElementById("donate-button");
const themeButton = document.getElementById("theme-button");
const onboardingPanel = document.getElementById("onboarding-panel");
const guidePanel = document.getElementById("guide-panel");

// ── Theme ───────────────────────────────────────────────────────────────────
const THEME_KEY = "bolha_tracker_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeButton.textContent = theme === "light" ? "☾" : "☀";
  themeButton.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
}

async function loadTheme() {
  const stored = await chrome.storage.local.get(THEME_KEY);
  applyTheme(stored[THEME_KEY] || "dark");
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
}

const state = {
  settings: {
    locale: "auto",
    refreshIntervalMinutes: 180,
    scheduledRefreshEnabled: true,
    notificationsEnabled: true,
    badgeCountEnabled: true
  },
  currentListing: null,
  currentTrackedItem: null,
  trackedItems: [],
  refreshingIds: new Set(),
  savingIds: new Set()
};

let toastTimer = null;

function locale() {
  return resolveLocale(state.settings.locale);
}

function t(key, substitutions) {
  return getMessage(key, locale(), substitutions);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("toast-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("toast-visible");
  }, 2400);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStaticCopy() {
  document.getElementById("header-byline").textContent = t("byline");
  document.getElementById("header-title").textContent = t("appTitle");
  document.getElementById("header-subtitle").textContent = t("subtitle");
  document.getElementById("header-badge").textContent = t("badgeMvp");
  document.getElementById("current-page-title").textContent = t("currentPageTitle");
  document.getElementById("current-page-subtitle").textContent = t("currentPageSubtitle");
  document.getElementById("tracked-listings-title").textContent = t("trackedTitle");
  document.getElementById("tracked-listings-subtitle").textContent = t("trackedSubtitle");
  document.getElementById("footer-copy").textContent = t("footerPrivacy");
  openOptionsButton.textContent = t("settingsLink");
  donateButton.textContent = t("donateLink");
}

function renderGuide() {
  guidePanel.innerHTML = `
    <div class="panel-heading">
      <div>
        <h2>${escapeHtml(t("guideTitle"))}</h2>
      </div>
    </div>
    <div class="guide-grid">
      ${[t("guideStep1"), t("guideStep2"), t("guideStep3"), t("guideStep4")]
        .map((step, index) => `
          <div class="guide-step">
            <span class="guide-index">${index + 1}</span>
            <p>${escapeHtml(step)}</p>
          </div>
        `).join("")}
    </div>
  `;
}

function renderOnboarding() {
  if (state.settings.onboardingCompleted) {
    onboardingPanel.hidden = true;
    onboardingPanel.innerHTML = "";
    return;
  }

  onboardingPanel.hidden = false;
  onboardingPanel.innerHTML = `
    <div class="panel-heading">
      <div>
        <h2>${escapeHtml(t("onboardingTitle"))}</h2>
        <p>${escapeHtml(t("onboardingCopy"))}</p>
      </div>
    </div>
    <div class="button-row">
      <button class="button button-primary" id="dismiss-onboarding-button" type="button">${escapeHtml(t("onboardingDismiss"))}</button>
      <button class="button button-ghost" id="onboarding-settings-button" type="button">${escapeHtml(t("onboardingOpenSettings"))}</button>
    </div>
  `;

  document.getElementById("dismiss-onboarding-button").addEventListener("click", dismissOnboarding);
  document.getElementById("onboarding-settings-button").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

function createThumbMarkup(item, large) {
  const className = large ? "thumb thumb-large" : "thumb";

  if (item.imageUrl) {
    return `<div class="${className}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}"></div>`;
  }

  return `<div class="${className}"><div class="thumb-fallback">B</div></div>`;
}

function createSellerChip(item) {
  const label = item.sellerName || t("sellerUnknown");

  if (item.sellerProfileUrl) {
    return `<a class="chip" href="${escapeHtml(item.sellerProfileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  }

  return `<span class="chip">${escapeHtml(label)}</span>`;
}

function createStatusBadge(status) {
  const tone = STATUS_META[status] ? STATUS_META[status].tone : "unchanged";
  const label = getStatusShortLabel(status, locale());

  return `<span class="status-pill status-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function createStateCard(title, description) {
  return `
    <div class="state-card">
      <div class="state-orb"></div>
      <div class="state-copy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
    </div>
  `;
}

function getDisplayPrice(item) {
  if (item.available === false) {
    return t("listingUnavailable");
  }

  return item.priceText || formatCurrency(item.currentPrice, item.currency);
}

function createSummaryCard(label, value) {
  return `
    <article class="summary-card">
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-value">${escapeHtml(value)}</span>
    </article>
  `;
}

function renderSummary() {
  const unseenDrops = state.trackedItems.filter((item) => item.hasUnseenDrop).length;
  const scheduleValue = state.settings.scheduledRefreshEnabled
    ? getRefreshFrequencyLabel(state.settings.refreshIntervalMinutes, locale())
    : t("scheduleOff");

  summaryGrid.innerHTML = [
    createSummaryCard(t("summaryTracked"), String(state.trackedItems.length)),
    createSummaryCard(t("summaryDrops"), String(unseenDrops)),
    createSummaryCard(t("summarySchedule"), scheduleValue)
  ].join("");
}

function renderCurrentPageCard(listing, trackedItem) {
  const alreadyTracked = Boolean(trackedItem);
  const isUnavailable = listing.available === false;
  const badgeStatus = isUnavailable ? "unavailable" : alreadyTracked ? "unchanged" : "dropped";
  const buttonDisabled = alreadyTracked || isUnavailable;
  const buttonClass = buttonDisabled ? "button-secondary" : "button-primary";
  const buttonText = isUnavailable ? t("listingUnavailable") : alreadyTracked ? t("alreadyTracked") : t("trackListing");
  const helperCopy = isUnavailable
    ? t("listingUnavailableHint")
    : alreadyTracked
      ? t("alreadyTrackedHint")
      : t("readyTrackHint");
  const chips = [
    listing.categoryLabel ? `<span class="chip">${escapeHtml(listing.categoryLabel)}</span>` : "",
    createSellerChip(listing)
  ].filter(Boolean).join("");

  currentPageContent.innerHTML = `
    <div class="feature-card">
      <div>${createThumbMarkup(listing, true)}</div>
      <div>
        <div class="feature-card-top">
          <div>
            <p class="section-kicker">${escapeHtml(t("bolhaListing"))}</p>
            <h3 class="feature-title">${escapeHtml(listing.title)}</h3>
          </div>
          ${createStatusBadge(badgeStatus)}
        </div>
        <div class="chip-row">${chips}</div>
        <div class="price-row">
          <p class="price price-hero">${escapeHtml(getDisplayPrice(listing))}</p>
        </div>
        <p class="support-copy">${escapeHtml(helperCopy)}</p>
        <div class="feature-card-actions">
          <button id="track-current-button" class="button ${buttonClass}" ${buttonDisabled ? "disabled" : ""}>${escapeHtml(buttonText)}</button>
          <a class="button button-ghost" href="${escapeHtml(listing.url)}" target="_blank" rel="noreferrer">${escapeHtml(t("openLink"))}</a>
        </div>
      </div>
    </div>
  `;

  if (!buttonDisabled) {
    document.getElementById("track-current-button").addEventListener("click", trackCurrentListing);
  }
}

function renderCurrentPage() {
  const listing = state.currentListing;

  if (!listing || !listing.isBolhaPage) {
    currentPageContent.innerHTML = createStateCard(t("openBolhaListing"), t("openBolhaDesc"));
    return;
  }

  if (!listing.isListing) {
    currentPageContent.innerHTML = createStateCard(t("pageNotTrackable"), t("pageNotTrackableDesc"));
    return;
  }

  renderCurrentPageCard(listing, state.currentTrackedItem);
}

function createSparklineMarkup(item) {
  const points = getPriceSeries(item);
  const path = buildSparklinePath(points, 240, 36);
  const tone = STATUS_META[item.status] ? STATUS_META[item.status].tone : "unchanged";

  if (!path) {
    return "";
  }

  return `
    <div class="trend-shell">
      <div class="chip-label">${escapeHtml(t("trend"))}</div>
      <svg class="sparkline sparkline-${escapeHtml(tone)}" viewBox="0 0 240 36" preserveAspectRatio="none" aria-hidden="true">
        <path d="${escapeHtml(path)}"></path>
      </svg>
    </div>
  `;
}

function createNotesEditor(item) {
  const saving = state.savingIds.has(item.id);

  return `
    <div class="meta-editor">
      <div class="field">
        <label for="notes-${escapeHtml(item.id)}">${escapeHtml(t("notesLabel"))}</label>
        <textarea id="notes-${escapeHtml(item.id)}" class="textarea" data-role="notes">${escapeHtml(item.notes || "")}</textarea>
      </div>
      <div class="field">
        <label for="tags-${escapeHtml(item.id)}">${escapeHtml(t("tagsLabel"))}</label>
        <input id="tags-${escapeHtml(item.id)}" class="input" data-role="tags" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="${escapeHtml(t("tagsPlaceholder"))}">
      </div>
      <div class="button-row">
        <button class="button button-secondary" data-action="save-meta" data-id="${escapeHtml(item.id)}" ${saving ? "disabled" : ""}>
          ${escapeHtml(t("saveDetails"))}
        </button>
      </div>
    </div>
  `;
}

function createListingCard(item) {
  const refreshing = state.refreshingIds.has(item.id);
  const difference = getPriceDifferenceSummary(item, locale());
  const statusSummary = getStatusSummary(item, locale());
  const recoverySummary = getRecoverySummary(item, locale());
  const tagsMarkup = item.tags && item.tags.length
    ? `<div class="chip-row">${item.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";
  const categoryChip = item.categoryLabel ? `<span class="chip">${escapeHtml(item.categoryLabel)}</span>` : "";
  const sellerChip = createSellerChip(item);
  const nextCheckCopy = item.nextCheckAt ? `${t("nextCheck")}: ${formatTimeUntil(item.nextCheckAt, locale())}` : t("scheduleOff");

  return `
    <article class="listing-card">
      <div class="listing-card-head">
        <div style="display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:start;">
          <div>${createThumbMarkup(item, false)}</div>
          <div>
            <div class="listing-card-head">
              <h3 class="listing-title"><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
              ${createStatusBadge(item.status)}
            </div>
            <p class="meta-line">${escapeHtml(formatRelativeTime(item.lastChecked, locale()))}</p>
            <div class="chip-row">${categoryChip}${sellerChip}</div>
            <div class="price-row">
              <p class="price">${escapeHtml(getDisplayPrice(item))}</p>
            </div>
            <p class="detail-copy">${escapeHtml(statusSummary || nextCheckCopy)}</p>
            ${difference ? `<p class="delta-copy delta-${escapeHtml((STATUS_META[item.status] || { tone: "unchanged" }).tone)}">${escapeHtml(difference)}</p>` : ""}
            <p class="helper-copy">${escapeHtml(recoverySummary || nextCheckCopy)}</p>
            ${item.lastError ? `<p class="error-copy">${escapeHtml(item.lastError)}</p>` : ""}
            ${item.notes ? `<p class="support-copy">${escapeHtml(item.notes)}</p>` : ""}
            ${tagsMarkup}
          </div>
        </div>
      </div>
      ${createSparklineMarkup(item)}
      <div class="button-row">
        <button class="button button-secondary" data-action="refresh" data-id="${escapeHtml(item.id)}" ${refreshing ? "disabled" : ""}>${escapeHtml(refreshing ? t("refreshing") : t("refresh"))}</button>
        <button class="button button-danger" data-action="remove" data-id="${escapeHtml(item.id)}">${escapeHtml(t("remove"))}</button>
      </div>
      ${createNotesEditor(item)}
    </article>
  `;
}

function renderTrackedListings() {
  const items = [...state.trackedItems].sort((first, second) => second.dateTracked - first.dateTracked);

  if (!items.length) {
    trackedList.innerHTML = createStateCard(t("noTrackedTitle"), t("noTrackedDesc"));
    return;
  }

  trackedList.innerHTML = items.map(createListingCard).join("");
}

async function sendMessageToActiveTab(type) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (error) {
    return null;
  }
}

function renderCurrentPageLoading() {
  currentPageContent.innerHTML = `
    <div class="loading-state">
      <div class="loading-line loading-line-strong"></div>
      <div class="loading-line"></div>
      <div class="loading-line loading-line-short"></div>
    </div>
  `;
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.GET_SETTINGS
  });

  if (response && response.ok) {
    state.settings = response.settings;
  }

  setStaticCopy();
  renderGuide();
  renderOnboarding();
  renderSummary();
}

async function loadCurrentPage() {
  renderCurrentPageLoading();
  const response = await sendMessageToActiveTab(MESSAGE_TYPES.GET_PAGE_LISTING);

  if (!response || !response.ok) {
    state.currentListing = {
      isBolhaPage: false,
      isListing: false
    };
    state.currentTrackedItem = null;
    renderCurrentPage();
    return;
  }

  state.currentListing = response.listing;
  state.currentTrackedItem = response.listing && response.listing.url
    ? await findTrackedListingByUrl(response.listing.url)
    : null;
  renderCurrentPage();
}

async function loadTrackedItems() {
  state.trackedItems = await getTrackedListings();

  if (state.currentListing && state.currentListing.url) {
    state.currentTrackedItem = await findTrackedListingByUrl(state.currentListing.url);
  }

  renderSummary();
  renderCurrentPage();
  renderTrackedListings();
}

async function trackCurrentListing() {
  if (!state.currentListing || !state.currentListing.isListing) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.ADD_TRACKED_LISTING,
    payload: state.currentListing
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  showToast(response.status === "duplicate" ? t("toastDuplicate") : t("toastAdded"));
  await loadTrackedItems();
}

async function refreshListing(id) {
  state.refreshingIds.add(id);
  renderTrackedListings();

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.REFRESH_TRACKED_LISTING,
      payload: { id }
    });

    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : t("toastRefreshFailed"));
      return;
    }

    if (response.item.lastError) {
      showToast(t("toastRefreshFailed"));
    } else if (response.item.status === "dropped") {
      showToast(t("toastPriceDrop"));
    } else {
      showToast(t("toastRefreshSuccess"));
    }

    await loadTrackedItems();
  } finally {
    state.refreshingIds.delete(id);
    renderTrackedListings();
  }
}

async function removeListing(id) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.REMOVE_TRACKED_LISTING,
    payload: { id }
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  showToast(t("toastRemoved"));
  await loadTrackedItems();
}

async function saveMeta(button) {
  const id = button.dataset.id;
  const card = button.closest(".listing-card");

  if (!id || !card) {
    return;
  }

  const notes = card.querySelector('[data-role="notes"]').value;
  const tags = card.querySelector('[data-role="tags"]').value;
  state.savingIds.add(id);
  renderTrackedListings();

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_TRACKED_LISTING_META,
      payload: { id, notes, tags }
    });

    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : t("toastRefreshFailed"));
      return;
    }

    showToast(t("toastDetailsSaved"));
    await loadTrackedItems();
  } finally {
    state.savingIds.delete(id);
    renderTrackedListings();
  }
}

async function dismissOnboarding() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: {
      ...state.settings,
      onboardingCompleted: true
    }
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  renderOnboarding();
}

function handleTrackedListClick(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "refresh" && id) {
    refreshListing(id);
  }

  if (action === "remove" && id) {
    removeListing(id);
  }

  if (action === "save-meta" && id) {
    saveMeta(button);
  }
}

function handleStorageChange(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  if (changes.trackedListings) {
    loadTrackedItems();
  }

  if (changes.trackerSettings) {
    loadSettings();
  }

  if (changes[THEME_KEY]) {
    applyTheme(changes[THEME_KEY].newValue || "dark");
  }
}

async function markDropsSeen() {
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.MARK_DROPS_SEEN
  });
}

async function init() {
  await loadTheme();
  trackedList.addEventListener("click", handleTrackedListClick);
  chrome.storage.onChanged.addListener(handleStorageChange);
  themeButton.addEventListener("click", toggleTheme);
  openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  donateButton.addEventListener("click", () => {
    if (!DONATION_URL) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  await loadSettings();
  await loadTrackedItems();
  await loadCurrentPage();
  await markDropsSeen();
}

init();
