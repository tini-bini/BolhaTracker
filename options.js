const {
  BOLHA_PAGE_CONFIG,
  DEFAULT_SETTINGS,
  DONATION_URL,
  ENTITLEMENT_KEY,
  FREE_LIMITS,
  MAX_IMPORT_SIZE_BYTES,
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
  buildSparklinePath,
  formatCurrency,
  getPriceAnalytics,
  getTrackedListingStats,
  getTrackedListings,
  isPaymentPending,
  isPremiumEntitled
} = globalThis.BolhaTrackerUtils;

const {
  formatRelativeTime,
  formatTimeUntil,
  getEntitlementCopy,
  getEntitlementLabel,
  getMessage,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const toast = document.getElementById("toast");
const themeButton = document.getElementById("theme-button");
const THEME_KEY = "bolha_tracker_theme";

const state = {
  settings: { ...DEFAULT_SETTINGS },
  entitlement: { plan: PLAN.FREE },
  trackedItems: [],
  syncBackupMeta: null,
  premiumRestoreDraft: {
    email: "",
    restoreCode: ""
  }
};

let toastTimer = null;

function locale() {
  return resolveLocale(state.settings ? state.settings.locale : "auto");
}

function t(key, substitutions) {
  return getMessage(key, locale(), substitutions);
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

function entitlementLabel() {
  return getEntitlementLabel(state.entitlement, locale());
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

function escapeHtml(value) {
  return String(value == null ? "" : value)
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
  themeButton.textContent = nextTheme === "dark" ? t("themeDark") : t("themeLight");
  themeButton.title = nextTheme === "dark" ? t("themeDarkTitle") : t("themeLightTitle");
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("toast-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("toast-visible");
  }, 2600);
}

function openDashboardPage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL("popup.html")
  });
}

function setStaticCopy() {
  document.getElementById("hero-byline").textContent = t("byline");
  document.getElementById("hero-title").textContent = t("optionsTitle");
  document.getElementById("hero-subtitle").textContent = t("optionsSubtitle");
  document.getElementById("open-dashboard-button").textContent = t("openDashboardPage");
  document.getElementById("donate-button").textContent = t("donateLink");
  document.getElementById("donate-button").disabled = !DONATION_URL;
  document.getElementById("overview-title").textContent = t("overviewTitle");
  document.getElementById("overview-subtitle").textContent = t("overviewSubtitle");
  document.getElementById("actions-title").textContent = t("actionsTitle");
  document.getElementById("actions-subtitle").textContent = t("actionsSubtitle");
  document.getElementById("premium-title").textContent = t("premiumTitle");
  document.getElementById("premium-subtitle").textContent = t("premiumSubtitle");
  document.getElementById("premium-compare-title").textContent = t("premiumCompareTitle");
  document.getElementById("premium-separate-donate").textContent = t("premiumSeparateDonate");
  document.getElementById("buy-premium-button").textContent = isPendingPremium() && state.entitlement && state.entitlement.checkoutUrl
    ? t("premiumCheckoutOpenButton")
    : t("premiumBuyButton");
  document.getElementById("already-paid-button").textContent = t("premiumAlreadyPaid");
  document.getElementById("copy-premium-request-button").textContent = t("premiumCopyRequest");
  document.getElementById("refresh-due-button").textContent = hasPremium() ? t("refreshDueAction") : t("premiumFeatureBulkRefresh");
  document.getElementById("reset-onboarding-button").textContent = t("resetOnboarding");
  document.getElementById("cloud-title").textContent = t("cloudTitle");
  document.getElementById("cloud-subtitle").textContent = t("cloudSubtitle");
  document.getElementById("cloud-backup-button").textContent = hasPremium() ? t("cloudBackupButton") : t("premiumBuyButton");
  document.getElementById("cloud-restore-button").textContent = hasPremium() ? t("cloudRestoreButton") : t("premiumAlreadyPaid");
  document.getElementById("presets-title").textContent = t("presetsTitle");
  document.getElementById("presets-subtitle").textContent = t("presetsSubtitle");
  document.getElementById("guide-title").textContent = t("guideTitle");
  document.getElementById("roadmap-title").textContent = t("roadmapTitle");
  document.getElementById("roadmap-functionality-title").textContent = t("roadmapFunctionality");
  document.getElementById("roadmap-functionality-copy").textContent = t("roadmapFunctionalityCopy");
  document.getElementById("roadmap-design-title").textContent = t("roadmapDesign");
  document.getElementById("roadmap-design-copy").textContent = t("roadmapDesignCopy");
  document.getElementById("roadmap-ease-title").textContent = t("roadmapEase");
  document.getElementById("roadmap-ease-copy").textContent = t("roadmapEaseCopy");
  document.getElementById("settings-title").textContent = t("settingsSection");
  document.getElementById("settings-help").textContent = t("refreshHelp");
  document.getElementById("refresh-frequency-label").textContent = t("refreshFrequency");
  document.getElementById("language-label").textContent = t("language");
  document.getElementById("scheduled-refresh-label").textContent = t("scheduledRefresh");
  document.getElementById("notifications-label").textContent = t("notificationsEnabled");
  document.getElementById("badge-count-label").textContent = t("badgeCount");
  document.getElementById("save-settings-button").textContent = t("saveSettings");
  document.getElementById("export-title").textContent = t("exportTitle");
  document.getElementById("export-desc").textContent = t("exportDesc");
  document.getElementById("export-button").textContent = t("exportButton");
  document.getElementById("import-title").textContent = t("importTitle");
  document.getElementById("import-desc").textContent = t("importDesc");
  document.getElementById("import-mode-label").textContent = t("importMode");
  document.getElementById("choose-file-label").textContent = t("chooseFile");
  document.getElementById("import-button").textContent = t("importButton");
  document.getElementById("diagnostics-title").textContent = t("diagnosticsTitle");
  document.getElementById("diagnostics-desc").textContent = t("diagnosticsDesc");
  document.getElementById("run-diagnostics-button").textContent = t("runDiagnostics");
  document.getElementById("selector-config-title").textContent = t("selectorConfig");
  document.getElementById("diagnostic-result-title").textContent = t("diagnosticResult");
  document.getElementById("analytics-title").textContent = t("analyticsTitle");
  document.getElementById("analytics-subtitle").textContent = t("analyticsSubtitle");
  document.getElementById("analytics-select-label").textContent = t("analyticsSelectLabel");
  document.getElementById("analytics-chart-title").textContent = t("analyticsChartTitle");
  document.getElementById("analytics-metrics-title").textContent = t("analyticsMetricsTitle");
}

function populateSelects() {
  const frequencySelect = document.getElementById("refresh-frequency");
  frequencySelect.innerHTML = REFRESH_INTERVALS
    .map((value) => `<option value="${value}">${t(`interval${value}`)}</option>`)
    .join("");

  const languageSelect = document.getElementById("language");
  languageSelect.innerHTML = [
    { value: "sl", label: t("localeSl") }
  ].map((option) => `<option value="${option.value}">${option.label}</option>`).join("");

  const importMode = document.getElementById("import-mode");
  importMode.innerHTML = [
    { value: "merge", label: t("importMerge") },
    { value: "replace", label: t("importReplace") }
  ].map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
}

function renderSettingsForm() {
  document.getElementById("refresh-frequency").value = String(state.settings.refreshIntervalMinutes);
  document.getElementById("language").value = state.settings.locale;
  document.getElementById("scheduled-refresh").checked = state.settings.scheduledRefreshEnabled;
  document.getElementById("notifications-enabled").checked = state.settings.notificationsEnabled;
  document.getElementById("badge-count").checked = state.settings.badgeCountEnabled;
}

function renderGuide() {
  document.getElementById("guide-output").innerHTML = [
    t("guideStep1"),
    t("guideStep2"),
    t("guideStep3"),
    t("guideStep4")
  ].map((step, index) => `<div class="diag-list"><strong>${index + 1}</strong><div>${step}</div></div>`).join("");
}

function renderSelectorConfig() {
  document.getElementById("selector-config-output").textContent = JSON.stringify(BOLHA_PAGE_CONFIG, null, 2);
}

function renderOverview() {
  const stats = getTrackedListingStats(state.trackedItems);
  const cards = [
    { label: t("summaryTracked"), value: stats.total, detail: t("summaryTrackedDetail") },
    { label: t("summaryDrops"), value: stats.unseenDrops, detail: stats.unseenDrops ? t("summaryDropsActive") : t("summaryDropsQuiet") },
    { label: t("summaryDue"), value: stats.due, detail: t("summaryDueDetail") },
    { label: t("summarySchedule"), value: stats.nextCheckAt ? formatTimeUntil(stats.nextCheckAt, locale()) : t("scheduleOff"), detail: stats.lastCheckedAt ? formatRelativeTime(stats.lastCheckedAt, locale()) : t("neverChecked") }
  ];

  document.getElementById("overview-grid").innerHTML = cards
    .map((card) => `
      <article class="overview-card">
        <span class="overview-label">${card.label}</span>
        <strong class="overview-value">${card.value}</strong>
        <span class="overview-detail">${card.detail}</span>
      </article>
    `)
    .join("");

  document.getElementById("shortcut-card").innerHTML = `
    <div class="diag-list">
      <strong>${t("shortcutsTitle")}</strong>
      <div>${t("shortcutOpenPopup")}</div>
      <div>${t("shortcutRefreshDue")}</div>
    </div>
  `;
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

function renderPremiumSection() {
  const statusCopy = getEntitlementCopy(state.entitlement, locale());
  const statusTone = getPremiumToneClass();
  const restoreDraft = getRestoreDraft();
  const detailsMarkup = getPremiumDetailsRows()
    .map((entry) => `
      <div class="diag-list">
        <strong>${escapeHtml(entry.label)}</strong>
        <div>${escapeHtml(entry.value)}</div>
      </div>
    `)
    .join("");

  document.getElementById("premium-status-card").innerHTML = `
    <div class="diagnostic-output">
      <div class="diag-list">
        <strong>${t("premiumPlanStatus")}</strong>
        <div><span class="status-pill ${statusTone}">${escapeHtml(entitlementLabel())}</span></div>
      </div>
      <div class="diag-list">
        <strong>${t("premiumPayOnce", [getPremiumPriceLabel()])}</strong>
        <div>${escapeHtml(statusCopy)}</div>
      </div>
      <div class="diag-list">
        <strong>${t("premiumSeparateDonate")}</strong>
        <div>${escapeHtml(t("premiumSubtitle"))}</div>
      </div>
      ${detailsMarkup}
      <label class="field">
        <span>${escapeHtml(t("premiumRestoreEmailLabel"))}</span>
        <input class="input" data-premium-field="email" type="email" value="${escapeHtml(restoreDraft.email)}" autocomplete="email">
      </label>
      <label class="field">
        <span>${escapeHtml(t("premiumRestoreCodeLabel"))}</span>
        <input class="input" data-premium-field="restoreCode" type="text" value="${escapeHtml(restoreDraft.restoreCode)}" autocapitalize="characters" spellcheck="false">
      </label>
      <div>${escapeHtml(t("premiumRestoreHint"))}</div>
    </div>
  `;

  document.getElementById("premium-comparison").innerHTML = `
    <div class="premium-compare-grid">
      <div class="premium-compare-head">${escapeHtml(t("premiumFreeColumn"))}</div>
      <div class="premium-compare-head">${escapeHtml(t("premiumPremiumColumn"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureTracked"))}: ${escapeHtml(t("premiumFeatureTrackedFreeValue", [FREE_LIMITS.trackedListings]))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureTracked"))}: ${escapeHtml(t("premiumFeatureTrackedPremiumValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureBulkRefresh"))}: ${escapeHtml(t("premiumFeatureBulkRefreshFreeValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureBulkRefresh"))}: ${escapeHtml(t("premiumFeatureBulkRefreshPremiumValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureNotes"))}: ${escapeHtml(t("premiumFeatureNotesFreeValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureNotes"))}: ${escapeHtml(t("premiumFeatureNotesPremiumValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureSavedViews"))}: ${escapeHtml(t("premiumFeatureSavedViewsFreeValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureSavedViews"))}: ${escapeHtml(t("premiumFeatureSavedViewsPremiumValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureCloud"))}: ${escapeHtml(t("premiumFeatureCloudFreeValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureCloud"))}: ${escapeHtml(t("premiumFeatureCloudPremiumValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureAnalytics"))}: ${escapeHtml(t("premiumFeatureAnalyticsFreeValue"))}</div>
      <div class="premium-compare-row">${escapeHtml(t("premiumFeatureAnalytics"))}: ${escapeHtml(t("premiumFeatureAnalyticsPremiumValue"))}</div>
    </div>
  `;

  document.getElementById("buy-premium-button").disabled = hasPremium();
  document.getElementById("buy-premium-button").textContent = isPendingPremium() && state.entitlement && state.entitlement.checkoutUrl
    ? t("premiumCheckoutOpenButton")
    : t("premiumBuyButton");
  document.getElementById("already-paid-button").textContent = t("premiumAlreadyPaid");
  document.getElementById("copy-premium-request-button").textContent = t("premiumCopyRequest");
}

function renderCloudStatus() {
  if (!featureAccess(PREMIUM_FEATURES.CLOUD_BACKUP).allowed) {
    document.getElementById("cloud-status").innerHTML = `
      <div class="diag-list">
        <strong>${t("premiumPlanLifetime")}</strong>
        <div>${t("premiumLockedCloud")}</div>
      </div>
    `;
    return;
  }

  const meta = state.syncBackupMeta;
  document.getElementById("cloud-status").innerHTML = meta
    ? `
      <div class="diag-list">
        <strong>${t("cloudStatusReady")}</strong>
        <div>${t("cloudStatusItems", [meta.itemCount])}</div>
        <div>${t("cloudStatusDate", [formatRelativeTime(meta.exportedAt, locale())])}</div>
      </div>
    `
    : `
      <div class="diag-list">
        <strong>${t("cloudStatusEmpty")}</strong>
        <div>${t("cloudStatusEmptyCopy")}</div>
      </div>
    `;
}

function renderPresetList() {
  const presets = state.settings.savedViews || [];
  const container = document.getElementById("preset-list");
  const savedViewAccess = featureAccess(PREMIUM_FEATURES.SAVED_VIEWS, {
    savedViewCount: presets.length
  });

  if (!presets.length) {
    container.innerHTML = `<div class="shortcut-card">${savedViewAccess.allowed ? t("presetEmpty") : t("premiumLockedSavedViews", [savedViewAccess.limit])}</div>`;
    return;
  }

  container.innerHTML = presets
    .map((preset) => `
      <div class="preset-item">
        <div>
          <strong>${escapeHtml(preset.name)}</strong>
          <div>${escapeHtml(preset.query || t("filterall"))} - ${escapeHtml(t(`filter${preset.filter}`))} - ${escapeHtml(t(`sort${preset.sort}`))}</div>
        </div>
        <button class="button button-secondary button-small" data-preset-remove="${escapeHtml(preset.id)}" type="button">${escapeHtml(t("remove"))}</button>
      </div>
    `)
    .join("");
}

function renderAnalytics() {
  const select = document.getElementById("analytics-listing");
  const chart = document.getElementById("analytics-chart");
  const metrics = document.getElementById("analytics-metrics");
  const analyticsAccess = featureAccess(PREMIUM_FEATURES.ANALYTICS);

  if (!analyticsAccess.allowed) {
    select.innerHTML = `<option value="">${escapeHtml(t("premiumPlanLifetime"))}</option>`;
    chart.innerHTML = `<p>${escapeHtml(t("premiumLockedAnalytics"))}</p>`;
    metrics.innerHTML = `
      <div class="diag-list">
        <strong>${escapeHtml(t("premiumPlanLifetime"))}</strong>
        <div>${escapeHtml(t("premiumFeatureAnalyticsPremiumValue"))}</div>
      </div>
    `;
    return;
  }

  const items = [...state.trackedItems].sort((first, second) => second.dateTracked - first.dateTracked);
  const currentValue = select.value;

  select.innerHTML = items.length
    ? items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("")
    : `<option value="">${escapeHtml(t("noTrackedTitle"))}</option>`;

  if (currentValue) {
    select.value = currentValue;
  }

  const selectedId = select.value || (items[0] && items[0].id);
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];

  if (!selectedItem) {
    chart.innerHTML = `<p>${t("noTrackedDesc")}</p>`;
    metrics.innerHTML = "";
    return;
  }

  if (!select.value && selectedItem.id) {
    select.value = selectedItem.id;
  }

  const points = selectedItem.priceHistory
    .filter((entry) => entry.available !== false && entry.price != null)
    .map((entry) => entry.price);
  const path = buildSparklinePath(points, 520, 180);
  const analytics = getPriceAnalytics(selectedItem);

  chart.innerHTML = path
    ? `
      <svg viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
        <path d="${path}"></path>
      </svg>
    `
    : `<p>${t("analyticsEmpty")}</p>`;

  metrics.innerHTML = `
    <div class="diag-list">
      <strong>${t("analyticsSamples")}</strong>
      <div>${analytics.sampleCount}</div>
    </div>
    <div class="diag-list">
      <strong>${t("analyticsLow")}</strong>
      <div>${analytics.low == null ? "-" : formatCurrency(analytics.low, selectedItem.currency)}</div>
    </div>
    <div class="diag-list">
      <strong>${t("analyticsHigh")}</strong>
      <div>${analytics.high == null ? "-" : formatCurrency(analytics.high, selectedItem.currency)}</div>
    </div>
    <div class="diag-list">
      <strong>${t("analyticsAverage")}</strong>
      <div>${analytics.average == null ? "-" : formatCurrency(analytics.average, selectedItem.currency)}</div>
    </div>
    <div class="diag-list">
      <strong>${t("analyticsChange")}</strong>
      <div>${analytics.delta == null ? "-" : `${analytics.delta > 0 ? "+" : ""}${formatCurrency(analytics.delta, selectedItem.currency)}`}</div>
    </div>
  `;
}

async function loadSyncStatus() {
  if (!featureAccess(PREMIUM_FEATURES.CLOUD_BACKUP).allowed) {
    state.syncBackupMeta = null;
    renderCloudStatus();
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.GET_SYNC_BACKUP_STATUS
  });

  state.syncBackupMeta = response && response.ok ? response.meta : null;
  renderCloudStatus();
}

async function buyPremium() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CREATE_CHECKOUT_SESSION
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("premiumLockedFeature"));
    return;
  }

  state.entitlement = response.entitlement || await getEntitlementState();
  setStaticCopy();
  renderPremiumSection();
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

    response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RESTORE_PREMIUM_ACCESS,
      payload: restoreDraft
    });
  } else {
    response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SYNC_ENTITLEMENT,
      payload: {
        force: Boolean(forceSync)
      }
    });
  }

  if (response && response.entitlement) {
    state.entitlement = response.entitlement;
  } else {
    state.entitlement = await getEntitlementState();
  }

  setStaticCopy();
  renderPremiumSection();
  renderCloudStatus();
  renderAnalytics();

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
    renderPremiumSection();
  }

  if (!silent) {
    showToast(wantsRestore ? t("premiumRestoreToast") : (hasPremium() ? t("premiumActivatedToast") : t("premiumSyncToast")));
  }

  return response;
}

async function loadSettings() {
  let response = null;

  try {
    response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS
    });
  } catch (error) {
    response = null;
  }

  if (response && response.ok) {
    state.settings = response.settings;
  }

  setStaticCopy();
  renderPremiumSection();
  populateSelects();
  renderSettingsForm();
  renderPresetList();
}

async function loadTrackedItems() {
  state.trackedItems = await getTrackedListings();
  renderPremiumSection();
  renderOverview();
  renderAnalytics();
}

function handlePremiumStatusInput(event) {
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

async function saveSettings() {
  const payload = {
    refreshIntervalMinutes: Number(document.getElementById("refresh-frequency").value),
    locale: document.getElementById("language").value,
    scheduledRefreshEnabled: document.getElementById("scheduled-refresh").checked,
    notificationsEnabled: document.getElementById("notifications-enabled").checked,
    badgeCountEnabled: document.getElementById("badge-count").checked,
    onboardingCompleted: state.settings.onboardingCompleted
  };

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastImportFailed"));
    return;
  }

  state.settings = response.settings;
  setStaticCopy();
  populateSelects();
  renderSettingsForm();
  renderOverview();
  renderPresetList();
  showToast(t("toastSettingsSaved"));
}

async function exportData() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.EXPORT_TRACKED_DATA
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastImportFailed"));
    return;
  }

  const payload = JSON.stringify(response.payload, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const datePart = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${getMessage("exportFilename", locale())}-${datePart}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData() {
  const fileInput = document.getElementById("import-file");
  const file = fileInput.files && fileInput.files[0];

  if (!file) {
    showToast(t("toastImportFailed"));
    return;
  }

  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    showToast(t("toastImportFailed"));
    return;
  }

  const text = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    showToast(t("toastImportFailed"));
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.IMPORT_TRACKED_DATA,
    payload: {
      data: parsed,
      mode: document.getElementById("import-mode").value
    }
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastImportFailed"));
    return;
  }

  state.settings = response.settings;
  setStaticCopy();
  populateSelects();
  renderSettingsForm();
  await loadTrackedItems();
  renderPresetList();
  showToast(t("toastImportDone", [response.importedCount]));
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

function renderDiagnosticsResult(result) {
  const container = document.getElementById("diagnostic-output");

  if (!result || !result.ok || !result.listing || !result.listing.isBolhaPage || !result.listing.isListing) {
    container.innerHTML = `<p>${t("diagnosticsNotBolha")}</p>`;
    return;
  }

  const listing = result.listing;
  const missing = globalThis.BolhaTrackerUtils.getMissingDiagnosticFields(listing);

  container.innerHTML = `
    <div class="diag-list">
      <div><strong>${escapeHtml(t("diagTitleField"))}:</strong> ${escapeHtml(listing.title || "-")}</div>
      <div><strong>${escapeHtml(t("diagPriceField"))}:</strong> ${escapeHtml(listing.priceText || "-")}</div>
      <div><strong>${escapeHtml(t("diagSellerField"))}:</strong> ${escapeHtml(listing.sellerName || "-")}</div>
      <div><strong>${escapeHtml(t("diagCategoryField"))}:</strong> ${escapeHtml(listing.categoryLabel || "-")}</div>
      <div><strong>${escapeHtml(t("diagStatusField"))}:</strong> ${escapeHtml(listing.available === false ? getMessage("statusUnavailable", locale()) : getMessage("statusUnchanged", locale()))}</div>
    </div>
    <div class="diag-list">
      <strong>${escapeHtml(t("diagnosticsHints"))}:</strong>
      <div>${escapeHtml((listing.extractionHints || []).join(", ") || "-")}</div>
    </div>
    <div class="diag-list">
      <strong>${escapeHtml(t("diagnosticsMissing"))}:</strong>
      <div>${escapeHtml(missing.length ? missing.join(", ") : t("diagnosticsOk"))}</div>
    </div>
  `;
}

async function runDiagnostics() {
  const response = await sendMessageToActiveTab(MESSAGE_TYPES.GET_PAGE_LISTING);
  renderDiagnosticsResult(response);
}

async function refreshDueListings() {
  if (!featureAccess(PREMIUM_FEATURES.BULK_REFRESH).allowed) {
    showToast(t("premiumLockedBulkRefresh"));
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.REFRESH_DUE_LISTINGS
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  await loadTrackedItems();
  showToast(response.refreshed ? t("toastDueRefreshed", [response.refreshed]) : t("toastNothingDue"));
}

async function resetOnboarding() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: {
      ...state.settings,
      onboardingCompleted: false
    }
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  renderSettingsForm();
  renderPresetList();
  showToast(t("toastOnboardingReset"));
}

async function createCloudBackup() {
  if (!featureAccess(PREMIUM_FEATURES.CLOUD_BACKUP).allowed) {
    showToast(t("premiumLockedCloud"));
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CREATE_SYNC_BACKUP
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.syncBackupMeta = response.meta;
  renderCloudStatus();
  showToast(t("toastCloudBackupSaved"));
}

async function restoreCloudBackup() {
  if (!featureAccess(PREMIUM_FEATURES.CLOUD_BACKUP).allowed) {
    showToast(t("premiumLockedCloud"));
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.RESTORE_SYNC_BACKUP
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  await loadSettings();
  await loadTrackedItems();
  await loadSyncStatus();
  showToast(t("toastCloudBackupRestored"));
}

async function removePreset(presetId) {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: {
      ...state.settings,
      savedViews: (state.settings.savedViews || []).filter((view) => view.id !== presetId)
    }
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastRefreshFailed"));
    return;
  }

  state.settings = response.settings;
  renderPresetList();
  showToast(t("toastPresetRemoved"));
}

async function init() {
  await loadTheme();
  await loadEntitlement();
  themeButton.addEventListener("click", toggleTheme);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[ENTITLEMENT_KEY]) {
      loadEntitlement().then(() => {
        setStaticCopy();
        renderPremiumSection();
        renderCloudStatus();
        renderAnalytics();
      });
    }
  });
  document.getElementById("save-settings-button").addEventListener("click", saveSettings);
  document.getElementById("export-button").addEventListener("click", exportData);
  document.getElementById("import-button").addEventListener("click", importData);
  document.getElementById("run-diagnostics-button").addEventListener("click", runDiagnostics);
  document.getElementById("refresh-due-button").addEventListener("click", refreshDueListings);
  document.getElementById("reset-onboarding-button").addEventListener("click", resetOnboarding);
  document.getElementById("cloud-backup-button").addEventListener("click", createCloudBackup);
  document.getElementById("cloud-restore-button").addEventListener("click", restoreCloudBackup);
  document.getElementById("buy-premium-button").addEventListener("click", buyPremium);
  document.getElementById("already-paid-button").addEventListener("click", () => {
    syncOrRestorePremium(true, false);
  });
  document.getElementById("copy-premium-request-button").addEventListener("click", copyPremiumRequest);
  document.getElementById("premium-status-card").addEventListener("input", handlePremiumStatusInput);
  document.getElementById("preset-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset-remove]");

    if (button) {
      removePreset(button.dataset.presetRemove);
    }
  });
  document.getElementById("analytics-listing").addEventListener("change", renderAnalytics);
  document.getElementById("open-dashboard-button").addEventListener("click", openDashboardPage);
  document.getElementById("donate-button").addEventListener("click", () => {
    if (!DONATION_URL || !isSafeWebUrl(DONATION_URL, { httpsOnly: true, allowHosts: ["paypal.me", "www.paypal.me"] })) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  await loadSettings();
  await loadTrackedItems();
  await syncOrRestorePremium(false, true);
  await loadSyncStatus();
  renderGuide();
  renderSelectorConfig();
  renderDiagnosticsResult(null);
}

init();
