const {
  DEFAULT_SETTINGS,
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
  getStatusShortLabel,
  getStatusSummary,
  resolveLocale
} = globalThis.BolhaTrackerI18n;

const THEME_KEY = "bolha_tracker_theme";
const REFRESH_INTERVALS = [30, 60, 180, 360, 720, 1440];
const POPUP_COPY = {
  en: {
    currentPageKicker: "Live capture",
    quickSettingsKicker: "Automation",
    trackedListingsKicker: "Watchlist",
    guideKicker: "Flow",
    onboardingKicker: "Welcome",
    notesAndTags: "Notes and tags",
    hideDetails: "Hide details",
    summaryTrackedDetail: "Local watchlist",
    summaryDropsActive: "Needs review",
    summaryDropsQuiet: "All quiet",
    summaryScheduleDetail: "Background checks"
  },
  sl: {
    currentPageKicker: "Zajem v zivo",
    quickSettingsKicker: "Avtomatika",
    trackedListingsKicker: "Seznam",
    guideKicker: "Tok",
    onboardingKicker: "Dobrodosli",
    notesAndTags: "Opombe in oznake",
    hideDetails: "Skrij podrobnosti",
    summaryTrackedDetail: "Lokalni seznam",
    summaryDropsActive: "Potreben pregled",
    summaryDropsQuiet: "Mirno",
    summaryScheduleDetail: "Pregledi v ozadju"
  }
};

const elements = {
  headerByline: document.getElementById("header-byline"),
  headerTitle: document.getElementById("header-title"),
  headerSubtitle: document.getElementById("header-subtitle"),
  headerBadge: document.getElementById("header-badge"),
  summaryGrid: document.getElementById("summary-grid"),
  currentPageKicker: document.getElementById("current-page-kicker"),
  currentPageTitle: document.getElementById("current-page-title"),
  currentPageSubtitle: document.getElementById("current-page-subtitle"),
  currentPageContent: document.getElementById("current-page-content"),
  onboardingPanel: document.getElementById("onboarding-panel"),
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
  currentListing: null,
  currentTrackedItem: null,
  trackedItems: [],
  refreshingIds: new Set(),
  savingIds: new Set(),
  expandedIds: new Set()
};

let toastTimer = null;

function locale() {
  return resolveLocale(state.settings.locale || "auto");
}

function t(key, substitutions) {
  return getMessage(key, locale(), substitutions);
}

function popupCopy(key) {
  const selectedLocale = locale().startsWith("sl") ? "sl" : "en";
  return POPUP_COPY[selectedLocale][key] || POPUP_COPY.en[key] || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const nextTheme = theme === "light" ? "dark" : "light";
  elements.themeButton.textContent = nextTheme === "dark" ? "Night" : "Day";
  elements.themeButton.title = nextTheme === "dark" ? "Switch to dark mode" : "Switch to light mode";
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

function populateQuickSettingsSelects() {
  elements.refreshFrequencySelect.innerHTML = REFRESH_INTERVALS
    .map((value) => `<option value="${value}">${escapeHtml(t(`interval${value}`))}</option>`)
    .join("");

  elements.languageSelect.innerHTML = [
    { value: "auto", label: t("localeAuto") },
    { value: "en", label: t("localeEn") },
    { value: "sl", label: t("localeSl") }
  ]
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
}

function renderQuickSettings() {
  elements.refreshFrequencySelect.value = String(state.settings.refreshIntervalMinutes);
  elements.languageSelect.value = state.settings.locale;
  elements.scheduledRefreshToggle.checked = Boolean(state.settings.scheduledRefreshEnabled);
  elements.notificationsToggle.checked = Boolean(state.settings.notificationsEnabled);
  elements.badgeCountToggle.checked = Boolean(state.settings.badgeCountEnabled);
}

function setStaticCopy() {
  elements.headerByline.textContent = t("byline");
  elements.headerTitle.textContent = t("appTitle");
  elements.headerSubtitle.textContent = t("subtitle");
  elements.headerBadge.textContent = state.settings.scheduledRefreshEnabled
    ? getRefreshFrequencyLabel(state.settings.refreshIntervalMinutes, locale())
    : t("scheduleOff");

  elements.currentPageKicker.textContent = popupCopy("currentPageKicker");
  elements.currentPageTitle.textContent = t("currentPageTitle");
  elements.currentPageSubtitle.textContent = t("currentPageSubtitle");

  elements.quickSettingsKicker.textContent = popupCopy("quickSettingsKicker");
  elements.quickSettingsTitle.textContent = t("settingsSection");
  elements.quickSettingsSubtitle.textContent = t("refreshHelp");
  elements.refreshFrequencyLabel.textContent = t("refreshFrequency");
  elements.languageLabel.textContent = t("language");
  elements.scheduledRefreshLabel.textContent = t("scheduledRefresh");
  elements.notificationsLabel.textContent = t("notificationsEnabled");
  elements.badgeCountLabel.textContent = t("badgeCount");
  elements.saveSettingsButton.textContent = t("saveSettings");

  elements.trackedListingsKicker.textContent = popupCopy("trackedListingsKicker");
  elements.trackedListingsTitle.textContent = t("trackedTitle");
  elements.trackedListingsSubtitle.textContent = t("trackedSubtitle");
  elements.footerCopy.textContent = t("footerPrivacy");
  elements.openOptionsButton.textContent = t("settingsLink");
  elements.donateButton.textContent = t("donateLink");
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
  const unseenDrops = state.trackedItems.filter((item) => item.hasUnseenDrop).length;
  const scheduleValue = state.settings.scheduledRefreshEnabled
    ? getRefreshFrequencyLabel(state.settings.refreshIntervalMinutes, locale())
    : t("scheduleOff");

  elements.summaryGrid.innerHTML = [
    createSummaryCard(t("summaryTracked"), String(state.trackedItems.length), popupCopy("summaryTrackedDetail")),
    createSummaryCard(t("summaryDrops"), String(unseenDrops), unseenDrops ? popupCopy("summaryDropsActive") : popupCopy("summaryDropsQuiet")),
    createSummaryCard(t("summarySchedule"), scheduleValue, popupCopy("summaryScheduleDetail"), true)
  ].join("");
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
      return `<div class="spotlight-media"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}"></div>`;
    }

    return `<div class="spotlight-media"><div class="spotlight-fallback">B</div></div>`;
  }

  if (item.imageUrl) {
    return `<div class="listing-thumb"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}"></div>`;
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
        <p class="section-kicker">${escapeHtml(popupCopy("guideKicker"))}</p>
        <h2>${escapeHtml(t("guideTitle"))}</h2>
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
        <p class="section-kicker">${escapeHtml(popupCopy("onboardingKicker"))}</p>
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
  const badgeStatus = isUnavailable ? "unavailable" : "unchanged";
  const buttonDisabled = alreadyTracked || isUnavailable;
  const buttonClass = buttonDisabled ? "button-secondary" : "button-primary";
  const buttonText = isUnavailable
    ? t("listingUnavailable")
    : alreadyTracked
      ? t("alreadyTracked")
      : t("trackListing");
  const helperCopy = isUnavailable
    ? t("listingUnavailableHint")
    : alreadyTracked
      ? t("alreadyTrackedHint")
      : t("readyTrackHint");
  const chips = [
    listing.categoryLabel ? `<span class="chip">${escapeHtml(listing.categoryLabel)}</span>` : "",
    createSellerChip(listing)
  ].filter(Boolean).join("");

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
        <div class="button-row">
          <button id="track-current-button" class="button ${buttonClass}" type="button" ${buttonDisabled ? "disabled" : ""}>${escapeHtml(buttonText)}</button>
          <a class="button button-secondary" href="${escapeHtml(listing.url)}" target="_blank" rel="noreferrer">${escapeHtml(t("openLink"))}</a>
        </div>
      </div>
    </article>
  `;

  if (!buttonDisabled) {
    document.getElementById("track-current-button").addEventListener("click", trackCurrentListing);
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

function createNotesEditor(item) {
  const saving = state.savingIds.has(item.id);

  return `
    <div class="editor-shell">
      <label class="field">
        <span class="field-label">${escapeHtml(t("notesLabel"))}</span>
        <textarea id="notes-${escapeHtml(item.id)}" class="textarea" data-role="notes" placeholder="${escapeHtml(t("notesPlaceholder"))}">${escapeHtml(item.notes || "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">${escapeHtml(t("tagsLabel"))}</span>
        <input id="tags-${escapeHtml(item.id)}" class="input" data-role="tags" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="${escapeHtml(t("tagsPlaceholder"))}">
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
  const notesPreview = item.notes ? `<p class="listing-note">${escapeHtml(item.notes)}</p>` : "";

  return `
    <article class="listing-card">
      <div class="listing-masthead">
        ${createThumbMarkup(item, false)}
        <div class="listing-body">
          <div class="listing-headline">
            <div>
              <h3 class="listing-title">
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
              </h3>
              <p class="meta-line">${escapeHtml(formatRelativeTime(item.lastChecked, locale()))}</p>
            </div>
            ${createStatusBadge(item.status)}
          </div>

          <div class="chip-row">
            ${categoryChip}
            ${createSellerChip(item)}
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
        <button class="button button-secondary" data-action="toggle-details" data-id="${escapeHtml(item.id)}" type="button">${escapeHtml(expanded ? popupCopy("hideDetails") : popupCopy("notesAndTags"))}</button>
        <button class="button button-danger" data-action="remove" data-id="${escapeHtml(item.id)}" type="button">${escapeHtml(t("remove"))}</button>
      </div>

      ${expanded ? createNotesEditor(item) : ""}
    </article>
  `;
}

function renderTrackedListings() {
  const items = [...state.trackedItems].sort((first, second) => second.dateTracked - first.dateTracked);

  if (!items.length) {
    elements.trackedList.innerHTML = createStateCard(t("noTrackedTitle"), t("noTrackedDesc"));
    return;
  }

  elements.trackedList.innerHTML = items.map(createListingCard).join("");
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

async function loadSettings() {
  let response = null;

  try {
    response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
  } catch (error) {
    response = null;
  }

  if (response && response.ok) {
    state.settings = response.settings;
  }

  setStaticCopy();
  populateQuickSettingsSelects();
  renderQuickSettings();
  renderGuide();
  renderOnboarding();
  renderSummary();
  renderCurrentPage();
  renderTrackedListings();
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

async function saveSettings() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: getSettingsPayloadFromForm()
  });

  if (!response || !response.ok) {
    showToast(response && response.error ? response.error : t("toastImportFailed"));
    return;
  }

  state.settings = response.settings;
  setStaticCopy();
  populateQuickSettingsSelects();
  renderQuickSettings();
  renderGuide();
  renderOnboarding();
  renderSummary();
  renderCurrentPage();
  renderTrackedListings();
  showToast(t("toastSettingsSaved"));
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

  state.expandedIds.delete(id);
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

  if (!notesField || !tagsField) {
    return;
  }

  state.savingIds.add(id);
  renderTrackedListings();

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_TRACKED_LISTING_META,
      payload: {
        id,
        notes: notesField.value,
        tags: tagsField.value
      }
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

function toggleExpanded(id) {
  if (!id) {
    return;
  }

  if (state.expandedIds.has(id)) {
    state.expandedIds.delete(id);
  } else {
    state.expandedIds.add(id);
  }

  renderTrackedListings();
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
    applyTheme(changes[THEME_KEY].newValue || "light");
  }
}

async function markDropsSeen() {
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.MARK_DROPS_SEEN
  });
}

function bindEvents() {
  elements.trackedList.addEventListener("click", handleTrackedListClick);
  chrome.storage.onChanged.addListener(handleStorageChange);
  elements.themeButton.addEventListener("click", toggleTheme);
  elements.openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.donateButton.addEventListener("click", () => {
    if (!DONATION_URL) {
      showToast(t("donateMissing"));
      return;
    }

    chrome.tabs.create({ url: DONATION_URL });
  });
  elements.saveSettingsButton.addEventListener("click", saveSettings);
}

async function init() {
  await loadTheme();
  bindEvents();
  await loadSettings();
  await loadTrackedItems();
  await loadCurrentPage();
  await markDropsSeen();
}

init();
