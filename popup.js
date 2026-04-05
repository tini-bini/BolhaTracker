const {
  DEFAULT_SETTINGS,
  DONATION_URL,
  ENTITLEMENT_KEY,
  FREE_LIMITS,
  MESSAGE_TYPES,
  PLAN,
  PREMIUM_FEATURES,
  PREMIUM_LIFETIME_CURRENCY,
  PREMIUM_LIFETIME_PRICE,
  getEntitlementState,
  getFeatureAvailability,
  isBolhaUrl,
  isSafeWebUrl,
  REFRESH_INTERVALS,
  STATUS_META,
  isPremiumEntitled,
  isPaymentPending,
  buildSparklinePath,
  filterTrackedListings,
  findTrackedListingByUrl,
  formatCurrency,
  getPriceSeries,
  getTrackedListingStats,
  getTrackedListings,
  sortTrackedListings
} = globalThis.BolhaTrackerUtils;

const {
  getMessage,
  getEntitlementCopy,
  getEntitlementLabel,
  formatRelativeTime,
  formatTimeUntil,
  getPriceDifferenceSummary,
  getRecoverySummary,
  getRefreshFrequencyLabel,
  getStatusShortLabel,
  getStatusSummary,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const THEME_KEY = "bolha_tracker_theme";
const VIEW_KEY = "bolha_tracker_popup_view";
const FILTER_KEYS = ["all", "drops", "due", "unavailable", "notes"];
const SORT_KEYS = ["recent", "lastChecked", "biggestDrop", "priceLow", "title", "oldest"];

const elements = {
  headerByline: document.getElementById("header-byline"),
  headerTitle: document.getElementById("header-title"),
  headerSubtitle: document.getElementById("header-subtitle"),
  headerBadge: document.getElementById("header-badge"),
  summaryGrid: document.getElementById("summary-grid"),
  onboardingPanel: document.getElementById("onboarding-panel"),
  premiumPanel: document.getElementById("premium-panel"),
  watchlistToolsKicker: document.getElementById("watchlist-tools-kicker"),
  watchlistToolsTitle: document.getElementById("watchlist-tools-title"),
  watchlistToolsSubtitle: document.getElementById("watchlist-tools-subtitle"),
  watchlistSearchLabel: document.getElementById("watchlist-search-label"),
  watchlistSearch: document.getElementById("watchlist-search"),
  watchlistSortLabel: document.getElementById("watchlist-sort-label"),
  watchlistSort: document.getElementById("watchlist-sort"),
  watchlistFilterStrip: document.getElementById("watchlist-filter-strip"),
  watchlistPresets: document.getElementById("watchlist-presets"),
  saveViewButton: document.getElementById("save-view-button"),
  refreshDueButton: document.getElementById("refresh-due-button"),
  openBolhaButton: document.getElementById("open-bolha-button"),
  currentPageKicker: document.getElementById("current-page-kicker"),
  currentPageTitle: document.getElementById("current-page-title"),
  currentPageSubtitle: document.getElementById("current-page-subtitle"),
  currentPageContent: document.getElementById("current-page-content"),
  quickSettingsKicker: document.getElementById("quick-settings-kicker"),
  quickSettingsTitle: document.getElementById("quick-settings-title"),
  quickSettingsSubtitle: document.getElementById("quick-settings-subtitle"),
  refreshFrequencyLabel: document.getElementById("refresh-frequency-label"),
  languageLabel: document.getElementById("language-label"),
  refreshFrequencySelect: document.getElementById("quick-refresh-frequency"),
  languageSelect: document.getElementById("quick-language"),
  scheduledRefreshToggle: document.getElementById("scheduled-refresh"),
  notificationsToggle: document.getElementById("notifications-enabled"),
  badgeCountToggle: document.getElementById("badge-count"),
  scheduledRefreshLabel: document.getElementById("scheduled-refresh-label"),
  notificationsLabel: document.getElementById("notifications-label"),
  badgeCountLabel: document.getElementById("badge-count-label"),
  saveSettingsButton: document.getElementById("save-settings-button"),
  guidePanel: document.getElementById("guide-panel"),
  trackedListingsKicker: document.getElementById("tracked-listings-kicker"),
  trackedListingsTitle: document.getElementById("tracked-listings-title"),
  trackedListingsSubtitle: document.getElementById("tracked-listings-subtitle"),
  trackedList: document.getElementById("tracked-list"),
  footerCopy: document.getElementById("footer-copy"),
  openOptionsButton: document.getElementById("open-options-button"),
  donateButton: document.getElementById("donate-button"),
  themeButton: document.getElementById("theme-button"),
  toast: document.getElementById("toast")
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  entitlement: { plan: PLAN.FREE },
  currentListing: null,
  currentTrackedItem: null,
  trackedItems: [],
  refreshingIds: new Set(),
  savingIds: new Set(),
  expandedIds: new Set(),
  metaDrafts: new Map(),
  premiumRestoreDraft: {
    email: "",
    restoreCode: ""
  },
  refreshDueBusy: false,
  view: loadViewState()
};

let toastTimer = null;

function loadViewState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      filter: FILTER_KEYS.includes(parsed.filter) ? parsed.filter : "all",
      sort: SORT_KEYS.includes(parsed.sort) ? parsed.sort : "recent"
    };
  } catch (error) {
    return { query: "", filter: "all", sort: "recent" };
  }
}

function saveViewState() {
  localStorage.setItem(VIEW_KEY, JSON.stringify(state.view));
}

function locale() {
  return resolveLocale(state.settings.locale || "auto");
}

function t(key, substitutions) {
  return getMessage(key, locale(), substitutions);
}

function entitlementLabel() {
  return getEntitlementLabel(state.entitlement, locale());
}

function hasPremium() {
  return isPremiumEntitled(state.entitlement);
}

function isPendingPremium() {
  return isPaymentPending(state.entitlement);
}

function featureAccess(feature, context) {
  return getFeatureAvailability(feature, state.entitlement, context);
}

function getPremiumPriceLabel() {
  return formatCurrency(PREMIUM_LIFETIME_PRICE, PREMIUM_LIFETIME_CURRENCY);
}

function getPremiumToneClass() {
  if (hasPremium()) {
    return "status-dropped";
  }

  if (state.entitlement && (state.entitlement.status === "payment_failed" || state.entitlement.status === "payment_cancelled" || state.entitlement.status === "entitlement_invalid")) {
    return "status-unavailable";
  }

  if (isPendingPremium()) {
    return "status-increased";
  }

  return "status-unchanged";
}

function getRestoreDraft() {
  return {
    email: String(state.premiumRestoreDraft && state.premiumRestoreDraft.email ? state.premiumRestoreDraft.email : ""),
    restoreCode: String(state.premiumRestoreDraft && state.premiumRestoreDraft.restoreCode ? state.premiumRestoreDraft.restoreCode : "")
  };
}

function getPremiumDetailsRows() {
  const rows = [
    {
      label: t("premiumInstallCodeLabel"),
      value: state.entitlement && state.entitlement.installCode ? state.entitlement.installCode : "n/a"
    }
  ];

  if (state.entitlement && state.entitlement.checkoutSessionId) {
    rows.push({
      label: t("premiumCheckoutLabel"),
      value: state.entitlement.checkoutSessionId
    });
  }

  if (state.entitlement && state.entitlement.maskedEmail) {
    rows.push({
      label: t("premiumPurchaseEmailLabel"),
      value: state.entitlement.maskedEmail
    });
  }

  if (state.entitlement && state.entitlement.restoreCode) {
    rows.push({
      label: t("premiumRestoreCodeValueLabel"),
      value: state.entitlement.restoreCode
    });
  }

  if (state.entitlement && state.entitlement.lastVerifiedAt) {
    rows.push({
      label: t("premiumLastVerifiedLabel"),
      value: formatRelativeTime(state.entitlement.lastVerifiedAt, locale())
    });
  }

  if (state.entitlement && state.entitlement.lastError) {
    rows.push({
      label: t("premiumFailureLabel"),
      value: state.entitlement.lastError
    });
  }

  return rows;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("toast-visible");
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

function applyTheme(theme) {
  const activeTheme = theme || "light";
  document.documentElement.setAttribute("data-theme", activeTheme);
  const nextTheme = activeTheme === "light" ? "dark" : "light";
  elements.themeButton.textContent = nextTheme === "dark" ? t("themeDark") : t("themeLight");
  elements.themeButton.title = nextTheme === "dark" ? t("themeDarkTitle") : t("themeLightTitle");
  elements.themeButton.setAttribute("aria-label", elements.themeButton.title);
}

async function loadTheme() {
  const stored = await chrome.storage.local.get(THEME_KEY);
  applyTheme(stored[THEME_KEY] || "light");
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
}

async function loadEntitlement() {
  state.entitlement = await getEntitlementState();
}

function getSettingsPayloadFromForm() {
  return {
    refreshIntervalMinutes: Number(elements.refreshFrequencySelect.value),
    locale: elements.languageSelect.value,
    scheduledRefreshEnabled: elements.scheduledRefreshToggle.checked,
    notificationsEnabled: elements.notificationsToggle.checked,
    badgeCountEnabled: elements.badgeCountToggle.checked,
    onboardingCompleted: state.settings.onboardingCompleted
  };
}

function isSettingsDirty() {
  const payload = getSettingsPayloadFromForm();
  return (
    payload.refreshIntervalMinutes !== state.settings.refreshIntervalMinutes ||
    payload.locale !== state.settings.locale ||
    payload.scheduledRefreshEnabled !== state.settings.scheduledRefreshEnabled ||
    payload.notificationsEnabled !== state.settings.notificationsEnabled ||
    payload.badgeCountEnabled !== state.settings.badgeCountEnabled
  );
}

function getVisibleTrackedItems() {
  return sortTrackedListings(
    filterTrackedListings(state.trackedItems, {
      query: state.view.query,
      filter: state.view.filter
    }),
    state.view.sort
  );
}

function setStaticCopy() {
  const stats = getTrackedListingStats(state.trackedItems);
  const filteredCount = getVisibleTrackedItems().length;

  elements.headerByline.textContent = t("byline");
  elements.headerTitle.textContent = t("appTitle");
  elements.headerSubtitle.textContent = t("subtitle");
  elements.headerBadge.textContent = state.settings.scheduledRefreshEnabled
    ? getRefreshFrequencyLabel(state.settings.refreshIntervalMinutes, locale())
    : t("scheduleOff");

  elements.watchlistToolsKicker.textContent = t("watchlistToolsKicker");
  elements.watchlistToolsTitle.textContent = t("watchlistToolsTitle");
  elements.watchlistToolsSubtitle.textContent = t("watchlistToolsSubtitle");
  elements.watchlistSearchLabel.textContent = t("watchlistSearchLabel");
  elements.watchlistSearch.placeholder = t("watchlistSearchPlaceholder");
  elements.watchlistSortLabel.textContent = t("watchlistSortLabel");
  elements.saveViewButton.textContent = featureAccess(PREMIUM_FEATURES.SAVED_VIEWS, {
    savedViewCount: (state.settings.savedViews || []).length
  }).allowed
    ? t("saveViewPreset")
    : t("premiumBuyButton");
  elements.refreshDueButton.textContent = hasPremium()
    ? (state.refreshDueBusy ? t("refreshing") : t("refreshDueButton", [stats.due]))
    : t("premiumFeatureBulkRefresh");
  elements.refreshDueButton.disabled = state.refreshDueBusy || (hasPremium() ? !stats.due : false);
  elements.openBolhaButton.textContent = t("openBolhaButton");

  elements.currentPageKicker.textContent = t("currentPageKicker");
  elements.currentPageTitle.textContent = t("currentPageTitle");
  elements.currentPageSubtitle.textContent = t("currentPageSubtitle");

  elements.quickSettingsKicker.textContent = t("quickSettingsKicker");
  elements.quickSettingsTitle.textContent = t("settingsSection");
  elements.quickSettingsSubtitle.textContent = t("refreshHelp");
  elements.refreshFrequencyLabel.textContent = t("refreshFrequency");
  elements.languageLabel.textContent = t("language");
  elements.scheduledRefreshLabel.textContent = t("scheduledRefresh");
  elements.notificationsLabel.textContent = t("notificationsEnabled");
  elements.badgeCountLabel.textContent = t("badgeCount");
  elements.saveSettingsButton.textContent = isSettingsDirty() ? t("saveSettings") : t("settingsSavedState");
  elements.saveSettingsButton.disabled = !isSettingsDirty();

  elements.trackedListingsKicker.textContent = t("trackedListingsKicker");
  elements.trackedListingsTitle.textContent = t("trackedTitle");
  elements.trackedListingsSubtitle.textContent = filteredCount === state.trackedItems.length
    ? t("trackedSubtitle")
    : t("trackedFilteredSubtitle", [filteredCount, state.trackedItems.length]);

  elements.footerCopy.textContent = t("footerPrivacy");
  elements.openOptionsButton.textContent = t("settingsLink");
  elements.donateButton.textContent = t("donateLink");
  elements.donateButton.disabled = !DONATION_URL;
}

function populateSelects() {
  elements.refreshFrequencySelect.innerHTML = REFRESH_INTERVALS
    .map((value) => `<option value="${value}">${escapeHtml(t(`interval${value}`))}</option>`)
    .join("");

  elements.languageSelect.innerHTML = [
    { value: "sl", label: t("localeSl") }
  ]
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");

  elements.watchlistSort.innerHTML = SORT_KEYS
    .map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(t(`sort${key}`))}</option>`)
    .join("");
}

function renderQuickSettings() {
  elements.refreshFrequencySelect.value = String(state.settings.refreshIntervalMinutes);
  elements.languageSelect.value = state.settings.locale;
  elements.scheduledRefreshToggle.checked = Boolean(state.settings.scheduledRefreshEnabled);
  elements.notificationsToggle.checked = Boolean(state.settings.notificationsEnabled);
  elements.badgeCountToggle.checked = Boolean(state.settings.badgeCountEnabled);
  elements.watchlistSearch.value = state.view.query;
  elements.watchlistSort.value = state.view.sort;
}

function createSummaryCard(label, value, detail, compactValue = false) {
  return `
    <article class="summary-card">
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-value ${compactValue ? "summary-value-compact" : ""}">${escapeHtml(value)}</span>
      <span class="summary-detail">${escapeHtml(detail)}</span>
    </article>
  `;
}

function renderSummary() {
  const stats = getTrackedListingStats(state.trackedItems);
  const scheduleValue = state.settings.scheduledRefreshEnabled
    ? getRefreshFrequencyLabel(state.settings.refreshIntervalMinutes, locale())
    : t("scheduleOff");

  elements.summaryGrid.innerHTML = [
    createSummaryCard(t("summaryTracked"), String(stats.total), t("summaryTrackedDetail")),
    createSummaryCard(t("summaryDrops"), String(stats.unseenDrops), stats.unseenDrops ? t("summaryDropsActive") : t("summaryDropsQuiet")),
    createSummaryCard(t("summaryDue"), String(stats.due), t("summaryDueDetail")),
    createSummaryCard(t("summarySchedule"), scheduleValue, t("summaryScheduleDetail"), true)
  ].join("");
}

function renderFilterStrip() {
  const counts = {
    all: state.trackedItems.length,
    drops: filterTrackedListings(state.trackedItems, { filter: "drops" }).length,
    due: filterTrackedListings(state.trackedItems, { filter: "due" }).length,
    unavailable: filterTrackedListings(state.trackedItems, { filter: "unavailable" }).length,
    notes: filterTrackedListings(state.trackedItems, { filter: "notes" }).length
  };

  elements.watchlistFilterStrip.innerHTML = FILTER_KEYS
    .map((filterKey) => `
      <button
        class="filter-chip ${state.view.filter === filterKey ? "filter-chip-active" : ""}"
        type="button"
        data-filter="${escapeHtml(filterKey)}"
        aria-pressed="${state.view.filter === filterKey ? "true" : "false"}"
      >
        <span>${escapeHtml(t(`filter${filterKey}`))}</span>
        <strong>${counts[filterKey]}</strong>
      </button>
    `)
    .join("");
}

function renderPresetStrip() {
  const presets = state.settings.savedViews || [];

  if (!presets.length) {
    elements.watchlistPresets.innerHTML = `<span class="preset-empty">${escapeHtml(t("presetEmpty"))}</span>`;
    return;
  }

  elements.watchlistPresets.innerHTML = presets
    .map((preset) => `
      <button class="preset-chip" type="button" data-preset-id="${escapeHtml(preset.id)}">
        ${escapeHtml(preset.name)}
      </button>
    `)
    .join("");
}

async function saveViewPreset() {
  const savedViewAccess = featureAccess(PREMIUM_FEATURES.SAVED_VIEWS, {
    savedViewCount: (state.settings.savedViews || []).length
  });

  if (!savedViewAccess.allowed) {
    showToast(t("premiumLockedSavedViews", [savedViewAccess.limit]));
    return;
  }

  const name = window.prompt(t("presetPrompt"), state.view.query || "");

  if (!name) {
    return;
  }

  const nextSettings = {
    ...state.settings,
    savedViews: [
      ...(state.settings.savedViews || []).filter((view) => view.name !== name.trim()),
      {
        name: name.trim(),
        query: state.view.query,
        filter: state.view.filter,
        sort: state.view.sort
      }
    ]
  };
  const response = await sendRuntimeMessage(MESSAGE_TYPES.UPDATE_SETTINGS, nextSettings);

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  renderPresetStrip();
  showToast(t("toastPresetSaved"));
}

function applyPreset(presetId) {
  const preset = (state.settings.savedViews || []).find((view) => view.id === presetId);

  if (!preset) {
    return;
  }

  state.view = {
    query: preset.query || "",
    filter: preset.filter || "all",
    sort: preset.sort || "recent"
  };
  saveViewState();
  renderQuickSettings();
  renderFilterStrip();
  setStaticCopy();
  renderTrackedListings();
}

function createStateCard(title, description) {
  return `
    <div class="state-card">
      <div class="state-orb" aria-hidden="true"></div>
      <div class="state-copy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
    </div>
  `;
}

function createThumbMarkup(item, large = false) {
  if (large) {
    if (item.imageUrl) {
      return `<div class="spotlight-media"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy"></div>`;
    }

    return `<div class="spotlight-media"><div class="spotlight-fallback">B</div></div>`;
  }

  if (item.imageUrl) {
    return `<div class="listing-thumb"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy"></div>`;
  }

  return `<div class="listing-thumb"><div class="thumb-fallback">B</div></div>`;
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

function getDisplayPrice(item) {
  if (item.available === false) {
    return t("listingUnavailable");
  }

  return item.priceText || formatCurrency(item.currentPrice, item.currency);
}

function renderGuide() {
  const steps = [t("guideStep1"), t("guideStep2"), t("guideStep3"), t("guideStep4")];

  elements.guidePanel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="section-kicker">${escapeHtml(t("guideKicker"))}</p>
        <h2>${escapeHtml(t("guideTitle"))}</h2>
        <p>${escapeHtml(t("guideSubtitle"))}</p>
      </div>
    </div>
    <div class="guide-grid">
      ${steps.map((step, index) => `
        <article class="guide-step">
          <span class="guide-index">${index + 1}</span>
          <p>${escapeHtml(step)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOnboarding() {
  if (state.settings.onboardingCompleted) {
    elements.onboardingPanel.hidden = true;
    elements.onboardingPanel.innerHTML = "";
    return;
  }

  elements.onboardingPanel.hidden = false;
  elements.onboardingPanel.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-copy">
        <p class="section-kicker">${escapeHtml(t("onboardingKicker"))}</p>
        <h2>${escapeHtml(t("onboardingTitle"))}</h2>
        <p>${escapeHtml(t("onboardingCopy"))}</p>
      </div>
      <div class="button-row">
        <button class="button button-primary" id="dismiss-onboarding-button" type="button">${escapeHtml(t("onboardingDismiss"))}</button>
        <button class="button button-secondary" id="onboarding-settings-button" type="button">${escapeHtml(t("onboardingOpenSettings"))}</button>
      </div>
    </div>
  `;

  document.getElementById("dismiss-onboarding-button").addEventListener("click", dismissOnboarding);
  document.getElementById("onboarding-settings-button").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

function buildPremiumSupportRequest() {
  const details = getPremiumDetailsRows();

  return [
    "BOLHA Sledilnik cen - Premium diagnostics",
    `Status: ${entitlementLabel()}`,
    `Tracked listings: ${state.trackedItems.length}`,
    ...details.map((entry) => `${entry.label}: ${entry.value}`)
  ].join("\n");
}

function renderPremiumPanel() {
  const trackedAccess = featureAccess(PREMIUM_FEATURES.TRACKED_LISTINGS, {
    trackedCount: state.trackedItems.length
  });
  const restoreDraft = getRestoreDraft();
  const planCopy = getEntitlementCopy(state.entitlement, locale());
  const detailsMarkup = getPremiumDetailsRows()
    .map((entry) => `<div class="chip"><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</div>`)
    .join("");
  const checkoutButtonLabel = isPendingPremium() && state.entitlement && state.entitlement.checkoutUrl
    ? t("premiumCheckoutOpenButton")
    : t("premiumBuyButton");
  const syncButtonLabel = t("premiumAlreadyPaid");

  elements.premiumPanel.innerHTML = `
    <div class="section-heading premium-heading">
      <div>
        <p class="section-kicker">${escapeHtml(t("premiumStatusKicker"))}</p>
        <h2>${escapeHtml(t("premiumTitle"))}</h2>
        <p>${escapeHtml(planCopy)}</p>
      </div>
      <span class="status-pill ${getPremiumToneClass()}">${escapeHtml(entitlementLabel())}</span>
    </div>
    <div class="premium-copy-row">
      <span class="chip">${escapeHtml(t("premiumPayOnce", [getPremiumPriceLabel()]))}</span>
      <span class="chip">${escapeHtml(t("premiumFeatureTrackedFreeValue", [FREE_LIMITS.trackedListings]))}</span>
      <span class="chip">${escapeHtml(t("premiumSeparateDonate"))}</span>
    </div>
    <div class="chip-row">${detailsMarkup}</div>
    <p class="helper-copy premium-limit-copy">${escapeHtml(t("premiumFeatureTracked"))}: ${escapeHtml(hasPremium() ? t("premiumFeatureTrackedPremiumValue") : t("premiumFeatureTrackedFreeValue", [trackedAccess.limit]))}</p>
    <div class="command-grid premium-restore-grid">
      <label class="field">
        <span class="field-label">${escapeHtml(t("premiumRestoreEmailLabel"))}</span>
        <input class="input" data-premium-field="email" type="email" value="${escapeHtml(restoreDraft.email)}" autocomplete="email">
      </label>
      <label class="field">
        <span class="field-label">${escapeHtml(t("premiumRestoreCodeLabel"))}</span>
        <input class="input" data-premium-field="restoreCode" type="text" value="${escapeHtml(restoreDraft.restoreCode)}" autocapitalize="characters" spellcheck="false">
      </label>
    </div>
    <p class="helper-copy">${escapeHtml(t("premiumRestoreHint"))}</p>
    <div class="button-row premium-actions">
      <button class="button button-primary" data-premium-action="checkout" type="button" ${hasPremium() ? "disabled" : ""}>${escapeHtml(checkoutButtonLabel)}</button>
      <button class="button button-secondary" data-premium-action="sync-or-restore" type="button">${escapeHtml(syncButtonLabel)}</button>
      <button class="button button-secondary button-small" data-premium-action="copy" type="button">${escapeHtml(t("premiumCopyRequest"))}</button>
    </div>
  `;
}

function renderCurrentPageLoading() {
  elements.currentPageContent.innerHTML = `
    <div class="loading-state">
      <div class="loading-line loading-line-strong"></div>
      <div class="loading-line"></div>
      <div class="loading-line loading-line-short"></div>
    </div>
  `;
}

function renderCurrentPageCard(listing, trackedItem) {
  const alreadyTracked = Boolean(trackedItem);
  const isUnavailable = listing.available === false;
  const trackedAccess = featureAccess(PREMIUM_FEATURES.TRACKED_LISTINGS, {
    trackedCount: state.trackedItems.length
  });
  const limitReached = !alreadyTracked && !trackedAccess.allowed;
  const badgeStatus = isUnavailable ? "unavailable" : "unchanged";
  const buttonDisabled = alreadyTracked || isUnavailable;
  const buttonClass = limitReached ? "button-primary" : (buttonDisabled ? "button-secondary" : "button-primary");
  const buttonText = isUnavailable
    ? t("listingUnavailable")
    : limitReached
      ? t("premiumLockedTrackButton")
    : alreadyTracked
      ? t("alreadyTracked")
      : t("trackListing");
  const helperCopy = isUnavailable
    ? t("listingUnavailableHint")
    : limitReached
      ? t("premiumLockedTracked", [trackedAccess.limit])
    : alreadyTracked
      ? t("alreadyTrackedHint")
      : t("readyTrackHint");
  const chips = [
    listing.categoryLabel ? `<span class="chip">${escapeHtml(listing.categoryLabel)}</span>` : "",
    createSellerChip(listing)
  ].filter(Boolean).join("");
  const nextCheckCopy = trackedItem && trackedItem.nextCheckAt
    ? `<p class="helper-copy">${escapeHtml(t("nextCheck"))}: ${escapeHtml(formatTimeUntil(trackedItem.nextCheckAt, locale()))}</p>`
    : "";

  elements.currentPageContent.innerHTML = `
    <article class="spotlight-card">
      ${createThumbMarkup(listing, true)}
      <div class="spotlight-copy">
        <div class="spotlight-headline">
          <div>
            <p class="section-kicker">${escapeHtml(t("bolhaListing"))}</p>
            <h3 class="spotlight-title">${escapeHtml(listing.title)}</h3>
          </div>
          ${createStatusBadge(badgeStatus)}
        </div>
        <div class="chip-row">${chips}</div>
        <p class="spotlight-price">${escapeHtml(getDisplayPrice(listing))}</p>
        <p class="support-copy">${escapeHtml(helperCopy)}</p>
        ${nextCheckCopy}
        <div class="button-row">
          <button id="track-current-button" class="button ${buttonClass}" type="button" ${buttonDisabled && !limitReached ? "disabled" : ""}>${escapeHtml(buttonText)}</button>
          <a class="button button-secondary" href="${escapeHtml(listing.url)}" target="_blank" rel="noreferrer">${escapeHtml(t("openLink"))}</a>
        </div>
      </div>
    </article>
  `;

  if (!buttonDisabled || limitReached) {
    document.getElementById("track-current-button").addEventListener("click", limitReached ? startPremiumCheckout : trackCurrentListing);
  }
}

function renderCurrentPage() {
  const listing = state.currentListing;

  if (!listing || !listing.isBolhaPage) {
    elements.currentPageContent.innerHTML = createStateCard(t("openBolhaListing"), t("openBolhaDesc"));
    return;
  }

  if (!listing.isListing) {
    elements.currentPageContent.innerHTML = createStateCard(t("pageNotTrackable"), t("pageNotTrackableDesc"));
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
      <span class="chip-label">${escapeHtml(t("trend"))}</span>
      <svg class="sparkline sparkline-${escapeHtml(tone)}" viewBox="0 0 240 36" preserveAspectRatio="none" aria-hidden="true">
        <path d="${escapeHtml(path)}"></path>
      </svg>
    </div>
  `;
}

function getDraft(item) {
  const draft = state.metaDrafts.get(item.id);

  return {
    notes: draft && typeof draft.notes === "string" ? draft.notes : item.notes || "",
    tags: draft && typeof draft.tags === "string" ? draft.tags : (item.tags || []).join(", "),
    sellerAlertEnabled: draft && typeof draft.sellerAlertEnabled === "boolean" ? draft.sellerAlertEnabled : Boolean(item.sellerAlertEnabled)
  };
}

function createNotesEditor(item) {
  const saving = state.savingIds.has(item.id);
  const draft = getDraft(item);

  return `
    <div class="editor-shell">
      <label class="field">
        <span class="field-label">${escapeHtml(t("notesLabel"))}</span>
        <textarea id="notes-${escapeHtml(item.id)}" class="textarea" data-role="notes" data-id="${escapeHtml(item.id)}" placeholder="${escapeHtml(t("notesPlaceholder"))}">${escapeHtml(draft.notes)}</textarea>
      </label>
      <label class="field">
        <span class="field-label">${escapeHtml(t("tagsLabel"))}</span>
        <input id="tags-${escapeHtml(item.id)}" class="input" data-role="tags" data-id="${escapeHtml(item.id)}" value="${escapeHtml(draft.tags)}" placeholder="${escapeHtml(t("tagsPlaceholder"))}">
      </label>
      <label class="toggle-inline">
        <input type="checkbox" data-role="seller-alert" data-id="${escapeHtml(item.id)}" ${draft.sellerAlertEnabled ? "checked" : ""}>
        <span>${escapeHtml(t("sellerAlertToggle"))}</span>
      </label>
      <div class="editor-actions">
        <button class="button button-primary" data-action="save-meta" data-id="${escapeHtml(item.id)}" type="button" ${saving ? "disabled" : ""}>${escapeHtml(t("saveDetails"))}</button>
      </div>
    </div>
  `;
}

function createListingCard(item) {
  const refreshing = state.refreshingIds.has(item.id);
  const expanded = state.expandedIds.has(item.id);
  const canEditNotes = featureAccess(PREMIUM_FEATURES.ADVANCED_NOTES).allowed;
  const difference = getPriceDifferenceSummary(item, locale());
  const statusSummary = getStatusSummary(item, locale());
  const recoverySummary = getRecoverySummary(item, locale());
  const tone = STATUS_META[item.status] ? STATUS_META[item.status].tone : "unchanged";
  const nextCheckCopy = item.nextCheckAt
    ? `${t("nextCheck")}: ${formatTimeUntil(item.nextCheckAt, locale())}`
    : t("scheduleOff");
  const tagsMarkup = item.tags && item.tags.length
    ? `<div class="chip-row">${item.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";
  const categoryChip = item.categoryLabel ? `<span class="chip">${escapeHtml(item.categoryLabel)}</span>` : "";
  const sellerAlertChip = item.sellerAlertEnabled ? `<span class="chip chip-accent">${escapeHtml(t("sellerAlertShort"))}</span>` : "";
  const notesPreview = item.notes ? `<p class="listing-note">${escapeHtml(item.notes)}</p>` : "";
  const needsAttention = item.hasUnseenDrop ? `<span class="attention-dot">${escapeHtml(t("attentionLabel"))}</span>` : "";

  return `
    <article class="listing-card ${item.hasUnseenDrop ? "listing-card-highlight" : ""}">
      <div class="listing-masthead">
        ${createThumbMarkup(item, false)}
        <div class="listing-body">
          <div class="listing-headline">
            <div>
              <div class="listing-title-row">
                <h3 class="listing-title">
                  <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
                </h3>
                ${needsAttention}
              </div>
              <p class="meta-line">${escapeHtml(formatRelativeTime(item.lastChecked, locale()))}</p>
            </div>
            ${createStatusBadge(item.status)}
          </div>

          <div class="chip-row">
            ${categoryChip}
            ${createSellerChip(item)}
            ${sellerAlertChip}
          </div>

          <div class="listing-price-row">
            <div class="price-stack">
              <p class="listing-price">${escapeHtml(getDisplayPrice(item))}</p>
              <p class="detail-copy">${escapeHtml(statusSummary || nextCheckCopy)}</p>
              ${difference ? `<p class="delta-copy delta-${escapeHtml(tone)}">${escapeHtml(difference)}</p>` : ""}
              <p class="helper-copy">${escapeHtml(recoverySummary || nextCheckCopy)}</p>
              ${item.lastError ? `<p class="error-copy">${escapeHtml(item.lastError)}</p>` : ""}
              ${notesPreview}
            </div>
          </div>

          ${tagsMarkup}
        </div>
      </div>

      ${createSparklineMarkup(item)}

      <div class="listing-actions">
        <button class="button button-secondary" data-action="refresh" data-id="${escapeHtml(item.id)}" type="button" ${refreshing ? "disabled" : ""}>${escapeHtml(refreshing ? t("refreshing") : t("refresh"))}</button>
        <button class="button button-secondary" data-action="toggle-details" data-id="${escapeHtml(item.id)}" type="button">${escapeHtml(canEditNotes ? (expanded ? t("hideDetails") : t("notesAndTags")) : t("premiumPlanLifetime"))}</button>
        <button class="button button-danger" data-action="remove" data-id="${escapeHtml(item.id)}" type="button">${escapeHtml(t("remove"))}</button>
      </div>

      ${expanded && canEditNotes ? createNotesEditor(item) : ""}
    </article>
  `;
}

function renderTrackedListings() {
  const items = getVisibleTrackedItems();

  if (!state.trackedItems.length) {
    elements.trackedList.innerHTML = createStateCard(t("noTrackedTitle"), t("noTrackedDesc"));
    return;
  }

  if (!items.length) {
    elements.trackedList.innerHTML = createStateCard(t("noMatchesTitle"), t("noMatchesDesc"));
    return;
  }

  elements.trackedList.innerHTML = items.map(createListingCard).join("");
}

async function sendRuntimeMessage(type, payload) {
  try {
    return await chrome.runtime.sendMessage({ type, payload });
  } catch (error) {
    return null;
  }
}

async function sendMessageToActiveTab(type) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id || !isBolhaUrl(tab.url || "")) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (error) {
    return null;
  }
}

async function startPremiumCheckout() {
  const response = await sendRuntimeMessage(MESSAGE_TYPES.CREATE_CHECKOUT_SESSION);

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("premiumLockedFeature"));
    return;
  }

  state.entitlement = response.entitlement || await getEntitlementState();
  renderPremiumPanel();
  showToast(t("premiumPendingToast"));
}

async function copyPremiumRequest() {
  try {
    await navigator.clipboard.writeText(buildPremiumSupportRequest());
    state.entitlement = await getEntitlementState();
    showToast(t("premiumSupportCopied"));
  } catch (error) {
    showToast(t("premiumCopyFailed"));
  }
}

async function syncOrRestorePremium(forceSync = true, silent = false) {
  const restoreDraft = getRestoreDraft();
  const wantsRestore = Boolean(restoreDraft.email || restoreDraft.restoreCode);
  let response = null;

  if (wantsRestore) {
    if (!restoreDraft.email || !restoreDraft.restoreCode) {
      if (!silent) {
        showToast(t("premiumRestoreHint"));
      }
      return null;
    }

    response = await sendRuntimeMessage(MESSAGE_TYPES.RESTORE_PREMIUM_ACCESS, restoreDraft);
  } else {
    response = await sendRuntimeMessage(MESSAGE_TYPES.SYNC_ENTITLEMENT, {
      force: Boolean(forceSync)
    });
  }

  if (response && response.entitlement) {
    state.entitlement = response.entitlement;
  } else {
    state.entitlement = await getEntitlementState();
  }

  renderPremiumPanel();
  setStaticCopy();
  renderCurrentPage();
  renderTrackedListings();

  if (!response || !response.ok) {
    if (!silent) {
      showToast(response && response.error ? response.error : t("premiumLockedFeature"));
    }
    return response;
  }

  if (wantsRestore) {
    state.premiumRestoreDraft = {
      email: "",
      restoreCode: ""
    };
    renderPremiumPanel();
  }

  if (!silent) {
    showToast(wantsRestore ? t("premiumRestoreToast") : (hasPremium() ? t("premiumActivatedToast") : t("premiumSyncToast")));
  }

  return response;
}

async function loadSettings() {
  const response = await sendRuntimeMessage(MESSAGE_TYPES.GET_SETTINGS);

  if (response && response.ok) {
    state.settings = response.settings;
  }

  populateSelects();
  renderQuickSettings();
  renderOnboarding();
  renderPremiumPanel();
  renderGuide();
  renderPresetStrip();
  setStaticCopy();
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
  renderFilterStrip();
  renderPresetStrip();
  renderPremiumPanel();
  setStaticCopy();
  renderCurrentPage();
  renderTrackedListings();
}

async function saveSettings() {
  const response = await sendRuntimeMessage(MESSAGE_TYPES.UPDATE_SETTINGS, getSettingsPayloadFromForm());

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastImportFailed"));
    return;
  }

  state.settings = response.settings;
  renderQuickSettings();
  renderSummary();
  setStaticCopy();
  renderCurrentPage();
  renderTrackedListings();
  showToast(t("toastSettingsSaved"));
}

async function trackCurrentListing() {
  if (!state.currentListing || !state.currentListing.isListing) {
    return;
  }

  const response = await sendRuntimeMessage(MESSAGE_TYPES.ADD_TRACKED_LISTING, state.currentListing);

  if (!response || !response.ok) {
    if (response && response.requiresPremium) {
      showToast(response.error || t("premiumLockedFeature"));
      return;
    }

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
    const response = await sendRuntimeMessage(MESSAGE_TYPES.REFRESH_TRACKED_LISTING, { id });

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

async function refreshDueListings() {
  if (!featureAccess(PREMIUM_FEATURES.BULK_REFRESH).allowed) {
    showToast(t("premiumLockedBulkRefresh"));
    return;
  }

  state.refreshDueBusy = true;
  setStaticCopy();

  try {
    const response = await sendRuntimeMessage(MESSAGE_TYPES.REFRESH_DUE_LISTINGS);

    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : t("toastRefreshFailed"));
      return;
    }

    await loadTrackedItems();
    showToast(response.refreshed ? t("toastDueRefreshed", [response.refreshed]) : t("toastNothingDue"));
  } finally {
    state.refreshDueBusy = false;
    setStaticCopy();
  }
}

async function removeListing(id) {
  const response = await sendRuntimeMessage(MESSAGE_TYPES.REMOVE_TRACKED_LISTING, { id });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.expandedIds.delete(id);
  state.metaDrafts.delete(id);
  showToast(t("toastRemoved"));
  await loadTrackedItems();
}

async function saveMeta(button) {
  const id = button.dataset.id;
  const card = button.closest(".listing-card");

  if (!id || !card) {
    return;
  }

  const notesField = card.querySelector('[data-role="notes"]');
  const tagsField = card.querySelector('[data-role="tags"]');
  const sellerAlertField = card.querySelector('[data-role="seller-alert"]');

  if (!notesField || !tagsField || !sellerAlertField) {
    return;
  }

  state.savingIds.add(id);
  renderTrackedListings();

  try {
    const response = await sendRuntimeMessage(MESSAGE_TYPES.UPDATE_TRACKED_LISTING_META, {
      id,
      notes: notesField.value,
      tags: tagsField.value,
      sellerAlertEnabled: sellerAlertField.checked
    });

    if (!response || !response.ok) {
      showToast(response && response.error ? response.error : t("toastRefreshFailed"));
      return;
    }

    state.metaDrafts.delete(id);
    showToast(t("toastDetailsSaved"));
    await loadTrackedItems();
  } finally {
    state.savingIds.delete(id);
    renderTrackedListings();
  }
}

async function dismissOnboarding() {
  const response = await sendRuntimeMessage(MESSAGE_TYPES.UPDATE_SETTINGS, {
    ...state.settings,
    onboardingCompleted: true
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  renderOnboarding();
}

function toggleExpanded(id) {
  if (!id) {
    return;
  }

  if (!featureAccess(PREMIUM_FEATURES.ADVANCED_NOTES).allowed) {
    showToast(t("premiumLockedNotes"));
    return;
  }

  if (state.expandedIds.has(id)) {
    state.expandedIds.delete(id);
  } else {
    state.expandedIds.add(id);
  }

  renderTrackedListings();
}

function updateDraft(id, role, value) {
  const draft = state.metaDrafts.get(id) || {};
  draft[role] = value;
  state.metaDrafts.set(id, draft);
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
    return;
  }

  if (action === "remove" && id) {
    removeListing(id);
    return;
  }

  if (action === "save-meta" && id) {
    saveMeta(button);
    return;
  }

  if (action === "toggle-details" && id) {
    toggleExpanded(id);
  }
}

function handleTrackedListInput(event) {
  const role = event.target.dataset.role;
  const id = event.target.dataset.id;

  if (!role || !id) {
    return;
  }

  if (role === "seller-alert") {
    updateDraft(id, "sellerAlertEnabled", event.target.checked);
    return;
  }

  updateDraft(id, role, event.target.value);
}

function handleFilterClick(event) {
  const button = event.target.closest("[data-filter]");

  if (!button) {
    return;
  }

  if (button.dataset.filter === "notes" && !featureAccess(PREMIUM_FEATURES.ADVANCED_NOTES).allowed) {
    showToast(t("premiumLockedNotes"));
    return;
  }

  state.view.filter = button.dataset.filter;
  saveViewState();
  renderFilterStrip();
  setStaticCopy();
  renderTrackedListings();
}

function handlePresetClick(event) {
  const button = event.target.closest("[data-preset-id]");

  if (!button) {
    return;
  }

  applyPreset(button.dataset.presetId);
}

function handleSettingsFieldChange() {
  setStaticCopy();
}

function handlePremiumPanelInput(event) {
  const field = event.target.dataset.premiumField;

  if (!field) {
    return;
  }

  if (field === "email") {
    state.premiumRestoreDraft.email = event.target.value.trim();
    return;
  }

  if (field === "restoreCode") {
    state.premiumRestoreDraft.restoreCode = event.target.value.toUpperCase().replace(/\s+/g, "");
    event.target.value = state.premiumRestoreDraft.restoreCode;
  }
}

function handlePremiumPanelClick(event) {
  const button = event.target.closest("[data-premium-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.premiumAction;

  if (action === "checkout") {
    startPremiumCheckout();
    return;
  }

  if (action === "sync-or-restore") {
    syncOrRestorePremium(true, false);
    return;
  }

  if (action === "copy") {
    copyPremiumRequest();
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
    loadSettings().then(() => loadTrackedItems());
  }

  if (changes[THEME_KEY]) {
    applyTheme(changes[THEME_KEY].newValue || "light");
  }

  if (changes[ENTITLEMENT_KEY]) {
    loadEntitlement().then(() => {
      renderPremiumPanel();
      setStaticCopy();
      renderCurrentPage();
      renderTrackedListings();
    });
  }
}

async function markDropsSeen() {
  await sendRuntimeMessage(MESSAGE_TYPES.MARK_DROPS_SEEN);
}

function bindEvents() {
  elements.trackedList.addEventListener("click", handleTrackedListClick);
  elements.trackedList.addEventListener("input", handleTrackedListInput);
  elements.premiumPanel.addEventListener("click", handlePremiumPanelClick);
  elements.premiumPanel.addEventListener("input", handlePremiumPanelInput);
  elements.watchlistFilterStrip.addEventListener("click", handleFilterClick);
  elements.watchlistPresets.addEventListener("click", handlePresetClick);
  chrome.storage.onChanged.addListener(handleStorageChange);

  elements.themeButton.addEventListener("click", toggleTheme);
  elements.openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.donateButton.addEventListener("click", () => {
    if (!DONATION_URL || !isSafeWebUrl(DONATION_URL, { httpsOnly: true, allowHosts: ["paypal.me", "www.paypal.me"] })) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.saveViewButton.addEventListener("click", saveViewPreset);
  elements.refreshDueButton.addEventListener("click", refreshDueListings);

  elements.watchlistSearch.addEventListener("input", (event) => {
    state.view.query = event.target.value.trimStart();
    saveViewState();
    setStaticCopy();
    renderTrackedListings();
  });

  elements.watchlistSort.addEventListener("change", (event) => {
    state.view.sort = event.target.value;
    saveViewState();
    renderTrackedListings();
  });

  [
    elements.refreshFrequencySelect,
    elements.languageSelect,
    elements.scheduledRefreshToggle,
    elements.notificationsToggle,
    elements.badgeCountToggle
  ].forEach((field) => {
    field.addEventListener("change", handleSettingsFieldChange);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.watchlistSearch.focus();
      elements.watchlistSearch.select();
      return;
    }

    if (event.key === "Escape" && document.activeElement === elements.watchlistSearch && elements.watchlistSearch.value) {
      elements.watchlistSearch.value = "";
      state.view.query = "";
      saveViewState();
      setStaticCopy();
      renderTrackedListings();
    }
  });
}

async function init() {
  await loadTheme();
  await loadEntitlement();
  bindEvents();
  await loadSettings();
  await loadTrackedItems();
  await syncOrRestorePremium(false, true);
  await loadCurrentPage();
  await markDropsSeen();
}

init();
