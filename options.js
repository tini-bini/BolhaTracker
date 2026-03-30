const {
  BOLHA_PAGE_CONFIG,
  DEFAULT_SETTINGS,
  DONATION_URL,
  MESSAGE_TYPES,
  REFRESH_INTERVALS,
  buildSparklinePath,
  formatCurrency,
  getPriceAnalytics,
  getTrackedListingStats,
  getTrackedListings
} = globalThis.BolhaTrackerUtils;

const {
  formatRelativeTime,
  formatTimeUntil,
  getMessage,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const toast = document.getElementById("toast");
const themeButton = document.getElementById("theme-button");
const THEME_KEY = "bolha_tracker_theme";

const state = {
  settings: { ...DEFAULT_SETTINGS },
  trackedItems: [],
  syncBackupMeta: null
};

let toastTimer = null;

function locale() {
  return resolveLocale(state.settings ? state.settings.locale : "auto");
}

function t(key, substitutions) {
  return getMessage(key, locale(), substitutions);
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

function setStaticCopy() {
  document.getElementById("hero-byline").textContent = t("byline");
  document.getElementById("hero-title").textContent = t("optionsTitle");
  document.getElementById("hero-subtitle").textContent = t("optionsSubtitle");
  document.getElementById("donate-button").textContent = t("donateLink");
  document.getElementById("donate-button").disabled = !DONATION_URL;
  document.getElementById("overview-title").textContent = t("overviewTitle");
  document.getElementById("overview-subtitle").textContent = t("overviewSubtitle");
  document.getElementById("actions-title").textContent = t("actionsTitle");
  document.getElementById("actions-subtitle").textContent = t("actionsSubtitle");
  document.getElementById("refresh-due-button").textContent = t("refreshDueAction");
  document.getElementById("reset-onboarding-button").textContent = t("resetOnboarding");
  document.getElementById("cloud-title").textContent = t("cloudTitle");
  document.getElementById("cloud-subtitle").textContent = t("cloudSubtitle");
  document.getElementById("cloud-backup-button").textContent = t("cloudBackupButton");
  document.getElementById("cloud-restore-button").textContent = t("cloudRestoreButton");
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

function renderCloudStatus() {
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

  if (!presets.length) {
    container.innerHTML = `<div class="shortcut-card">${t("presetEmpty")}</div>`;
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
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.GET_SYNC_BACKUP_STATUS
  });

  state.syncBackupMeta = response && response.ok ? response.meta : null;
  renderCloudStatus();
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
  populateSelects();
  renderSettingsForm();
  renderPresetList();
}

async function loadTrackedItems() {
  state.trackedItems = await getTrackedListings();
  renderOverview();
  renderAnalytics();
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

  if (!tab || !tab.id) {
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
  themeButton.addEventListener("click", toggleTheme);
  document.getElementById("save-settings-button").addEventListener("click", saveSettings);
  document.getElementById("export-button").addEventListener("click", exportData);
  document.getElementById("import-button").addEventListener("click", importData);
  document.getElementById("run-diagnostics-button").addEventListener("click", runDiagnostics);
  document.getElementById("refresh-due-button").addEventListener("click", refreshDueListings);
  document.getElementById("reset-onboarding-button").addEventListener("click", resetOnboarding);
  document.getElementById("cloud-backup-button").addEventListener("click", createCloudBackup);
  document.getElementById("cloud-restore-button").addEventListener("click", restoreCloudBackup);
  document.getElementById("preset-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset-remove]");

    if (button) {
      removePreset(button.dataset.presetRemove);
    }
  });
  document.getElementById("analytics-listing").addEventListener("change", renderAnalytics);
  document.getElementById("donate-button").addEventListener("click", () => {
    if (!DONATION_URL) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  await loadSettings();
  await loadTrackedItems();
  await loadSyncStatus();
  renderGuide();
  renderSelectorConfig();
  renderDiagnosticsResult(null);
}

init();
