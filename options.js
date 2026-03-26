const {
  BOLHA_PAGE_CONFIG,
  DEFAULT_SETTINGS,
  DONATION_URL,
  MESSAGE_TYPES
} = globalThis.BolhaTrackerUtils;

const {
  getMessage,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const toast = document.getElementById("toast");
const themeButton = document.getElementById("theme-button");

const state = {
  settings: { ...DEFAULT_SETTINGS }
};

// ── Theme ──────────────────────────────────────────────────────────────────
const THEME_KEY = "bolha_tracker_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeButton.textContent = theme === "light" ? "☾" : "☀";
  themeButton.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
  themeButton.textContent = theme === "light" ? "Dark" : "Light";
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

let toastTimer = null;

function locale() {
  return resolveLocale(state.settings ? state.settings.locale : "auto");
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
  }, 2600);
}

function setStaticCopy() {
  document.getElementById("hero-byline").textContent = t("byline");
  document.getElementById("hero-title").textContent = t("optionsTitle");
  document.getElementById("hero-subtitle").textContent = t("optionsSubtitle");
  document.getElementById("donate-button").textContent = t("donateLink");
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
}

function populateSelects() {
  const frequencySelect = document.getElementById("refresh-frequency");
  frequencySelect.innerHTML = [30, 60, 180, 360, 720, 1440]
    .map((value) => `<option value="${value}">${t(`interval${value}`)}</option>`)
    .join("");

  const languageSelect = document.getElementById("language");
  languageSelect.innerHTML = [
    { value: "auto", label: t("localeAuto") },
    { value: "en", label: t("localeEn") },
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
}

function renderSelectorConfig() {
  document.getElementById("selector-config-output").textContent = JSON.stringify(BOLHA_PAGE_CONFIG, null, 2);
}

function renderGuide() {
  document.getElementById("guide-output").innerHTML = [
    t("guideStep1"),
    t("guideStep2"),
    t("guideStep3"),
    t("guideStep4")
  ].map((step, index) => `<div class="diag-list"><strong>${index + 1}</strong><div>${step}</div></div>`).join("");
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
      <div><strong>${t("diagTitleField")}:</strong> ${listing.title || "-"}</div>
      <div><strong>${t("diagPriceField")}:</strong> ${listing.priceText || "-"}</div>
      <div><strong>${t("diagSellerField")}:</strong> ${listing.sellerName || "-"}</div>
      <div><strong>${t("diagCategoryField")}:</strong> ${listing.categoryLabel || "-"}</div>
      <div><strong>${t("diagStatusField")}:</strong> ${listing.available === false ? getMessage("statusUnavailable", locale()) : getMessage("statusUnchanged", locale())}</div>
    </div>
    <div class="diag-list">
      <strong>${t("diagnosticsHints")}:</strong>
      <div>${(listing.extractionHints || []).join(", ") || "-"}</div>
    </div>
    <div class="diag-list">
      <strong>${t("diagnosticsMissing")}:</strong>
      <div>${missing.length ? missing.join(", ") : t("diagnosticsOk")}</div>
    </div>
  `;
}

async function runDiagnostics() {
  const response = await sendMessageToActiveTab(MESSAGE_TYPES.GET_PAGE_LISTING);
  renderDiagnosticsResult(response);
}

async function init() {
  await loadTheme();
  themeButton.addEventListener("click", toggleTheme);
  document.getElementById("save-settings-button").addEventListener("click", saveSettings);
  document.getElementById("export-button").addEventListener("click", exportData);
  document.getElementById("import-button").addEventListener("click", importData);
  document.getElementById("run-diagnostics-button").addEventListener("click", runDiagnostics);
  document.getElementById("donate-button").addEventListener("click", () => {
    if (!DONATION_URL) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  await loadSettings();
  renderGuide();
  renderSelectorConfig();
  renderDiagnosticsResult(null);
}

init();
