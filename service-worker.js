importScripts("utils.js", "i18n.js");

const {
  ALARM_NAME,
  ENTITLEMENT_STATUS,
  MESSAGE_TYPES,
  applyResolvedEntitlementResponse,
  createExportPayload,
  createRefreshFailureItem,
  createTrackedListing,
  clampSettingsToEntitlement,
  extractListingFromHtml,
  getBackendConfig,
  findTrackedListingByUrl,
  formatCurrency,
  getEntitlementState,
  getFeatureAvailability,
  getListingId,
  getSettings,
  getPriceAnalytics,
  getTrackedListings,
  getUnseenDropCount,
  markCheckoutPending,
  PREMIUM_FEATURES,
  markDropNotificationSent,
  markDropsSeen,
  mergeImportedData,
  mergeTrackedListing,
  normalizeImportPayload,
  normalizeStoredListing,
  normalizeTags,
  normalizeUrl,
  removeTrackedListing,
  saveEntitlementState,
  saveSettings,
  saveTrackedListings,
  setEntitlementSyncError,
  shouldRefreshEntitlement,
  shouldNotifyPriceDrop,
  applyScheduledMetadata
} = globalThis.BolhaTrackerUtils;

const {
  getMessage,
  getNotificationMessage
} = globalThis.BolhaTrackerI18n;

const FETCH_TIMEOUT_MS = 15000;
const PREMIUM_FETCH_TIMEOUT_MS = 12000;
const MAX_PARALLEL_REFRESHES = 3;
const SYNC_BACKUP_META_KEY = "cloudBackupMeta";
const SYNC_BACKUP_CHUNK_PREFIX = "cloudBackupChunk_";
const SYNC_BACKUP_CHUNK_SIZE = 7000;
const LOCAL_SAFETY_BACKUP_KEY = "lastSafetyBackup";
const EXTENSION_BASE_URL = chrome.runtime.getURL("");

function isTrustedSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) {
    return false;
  }

  if (sender.url) {
    return sender.url.startsWith(EXTENSION_BASE_URL) || /^https:\/\/www\.bolha\.com\//i.test(String(sender.url));
  }

  if (sender.tab && sender.tab.url) {
    return /^https:\/\/www\.bolha\.com\//i.test(String(sender.tab.url));
  }

  return false;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateMessage(message) {
  if (!isPlainObject(message) || typeof message.type !== "string") {
    return { ok: false, error: "Neveljavno sporočilo." };
  }

  return { ok: true };
}

async function openExtensionPage(page) {
  const targetPage = page === "options" ? "options.html" : "popup.html";
  await chrome.tabs.create({
    url: chrome.runtime.getURL(targetPage)
  });

  return { ok: true };
}

function createPremiumError(error, feature, limit) {
  return {
    ok: false,
    error,
    feature,
    limit,
    requiresPremium: true
  };
}

function getPremiumErrorMessage(feature, locale, limit) {
  if (feature === PREMIUM_FEATURES.TRACKED_LISTINGS) {
    return getMessage("premiumLockedTracked", locale, [limit]);
  }

  if (feature === PREMIUM_FEATURES.BULK_REFRESH) {
    return getMessage("premiumLockedBulkRefresh", locale);
  }

  if (feature === PREMIUM_FEATURES.SAVED_VIEWS) {
    return getMessage("premiumLockedSavedViews", locale, [limit]);
  }

  if (feature === PREMIUM_FEATURES.ADVANCED_NOTES || feature === PREMIUM_FEATURES.SELLER_ALERTS) {
    return getMessage("premiumLockedNotes", locale);
  }

  if (feature === PREMIUM_FEATURES.CLOUD_BACKUP) {
    return getMessage("premiumLockedCloud", locale);
  }

  if (feature === PREMIUM_FEATURES.ANALYTICS) {
    return getMessage("premiumLockedAnalytics", locale);
  }

  return getMessage("premiumLockedFeature", locale);
}

async function updateBadge(items, settings) {
  if (!settings.badgeCountEnabled) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const count = getUnseenDropCount(items);

  await chrome.action.setBadgeBackgroundColor({
    color: "#1f8f63"
  });
  await chrome.action.setBadgeText({
    text: count > 0 ? String(Math.min(count, 99)) : ""
  });
}

async function scheduleRefreshAlarm(settings) {
  await chrome.alarms.clear(ALARM_NAME);

  if (!settings.scheduledRefreshEnabled) {
    return;
  }

  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: settings.refreshIntervalMinutes
  });
}

function isAbortError(error) {
  return error && (error.name === "AbortError" || String(error.message || "").toLowerCase().includes("aborted"));
}

async function clampStoredSettingsToEntitlement(entitlement) {
  const current = await getSettings();
  const clamped = clampSettingsToEntitlement(current, entitlement);

  if (JSON.stringify(current) !== JSON.stringify(clamped)) {
    await saveSettings(clamped);
  }

  return clamped;
}

async function fetchPremiumApi(path, body) {
  const backendConfig = await getBackendConfig();
  const endpoint = `${backendConfig.apiBaseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PREMIUM_FETCH_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Povezava s premium strežnikom je potekla.");
    }

    throw new Error("Povezave s premium strežnikom ni bilo mogoče vzpostaviti.");
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : `Premium strežnik je vrnil stanje ${response.status}.`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Premium strežnik je vrnil neveljaven odgovor.");
  }

  return payload;
}

async function syncEntitlementState(options = {}) {
  const force = Boolean(options.force);
  const current = await getEntitlementState();

  if (!force && !shouldRefreshEntitlement(current)) {
    const settings = await clampStoredSettingsToEntitlement(current);
    return {
      ok: true,
      entitlement: current,
      settings,
      skipped: true
    };
  }

  try {
    const response = await fetchPremiumApi("/api/entitlements/resolve", {
      installCode: current.installCode
    });
    const entitlement = await applyResolvedEntitlementResponse(response);
    const settings = await clampStoredSettingsToEntitlement(entitlement);
    return {
      ok: true,
      entitlement,
      settings,
      skipped: false
    };
  } catch (error) {
    const entitlement = await setEntitlementSyncError(error.message);
    const settings = await clampStoredSettingsToEntitlement(entitlement);
    return {
      ok: false,
      entitlement,
      settings,
      error: error.message || "Sinhronizacija premium stanja ni uspela."
    };
  }
}

async function createCheckoutSession() {
  const entitlement = await getEntitlementState();

  if (entitlement.status === ENTITLEMENT_STATUS.PREMIUM_ACTIVE) {
    return {
      ok: true,
      status: entitlement.status,
      entitlement
    };
  }

  if (
    (entitlement.status === ENTITLEMENT_STATUS.CHECKOUT_PENDING || entitlement.status === ENTITLEMENT_STATUS.VERIFICATION_PENDING) &&
    entitlement.checkoutUrl
  ) {
    await chrome.tabs.create({ url: entitlement.checkoutUrl });
    return {
      ok: true,
      status: entitlement.status,
      checkoutSessionId: entitlement.checkoutSessionId,
      checkoutUrl: entitlement.checkoutUrl,
      entitlement
    };
  }

  const response = await fetchPremiumApi("/api/checkout/session", {
    installCode: entitlement.installCode,
    plan: "premium_lifetime",
    source: "extension"
  });

  if (!response.checkoutUrl || !response.checkoutSessionId) {
    throw new Error("Checkout ni vrnil veljavne seje.");
  }

  const nextEntitlement = await markCheckoutPending(response.checkoutSessionId, response.checkoutUrl, "stripe");
  await chrome.tabs.create({ url: response.checkoutUrl });

  return {
    ok: true,
    status: response.status || ENTITLEMENT_STATUS.CHECKOUT_PENDING,
    checkoutSessionId: response.checkoutSessionId,
    checkoutUrl: response.checkoutUrl,
    entitlement: nextEntitlement
  };
}

async function restorePremiumAccess(payload) {
  const entitlement = await getEntitlementState();
  const email = String(payload && payload.email ? payload.email : "").trim().toLowerCase();
  const restoreCode = String(payload && payload.restoreCode ? payload.restoreCode : "").trim().toUpperCase();

  if (!email || !restoreCode) {
    return {
      ok: false,
      error: "Za obnovo premium dostopa vnesite e-pošto in obnovitveno kodo.",
      entitlement
    };
  }

  try {
    const response = await fetchPremiumApi("/api/entitlements/restore", {
      installCode: entitlement.installCode,
      email,
      restoreCode
    });
    const nextEntitlement = await applyResolvedEntitlementResponse(response);
    const settings = await clampStoredSettingsToEntitlement(nextEntitlement);

    return {
      ok: true,
      entitlement: nextEntitlement,
      settings
    };
  } catch (error) {
    const nextEntitlement = await setEntitlementSyncError(error.message, ENTITLEMENT_STATUS.ENTITLEMENT_INVALID);
    return {
      ok: false,
      error: error.message || "Obnova premium dostopa ni uspela.",
      entitlement: nextEntitlement
    };
  }
}

async function bootstrapBackgroundState() {
  const syncResult = await syncEntitlementState({ force: false });
  const settings = syncResult && syncResult.settings ? syncResult.settings : await getSettings();
  const items = await getTrackedListings();
  await scheduleRefreshAlarm(settings);
  await updateBadge(items, settings);
}

async function fetchListingSnapshot(url) {
  if (!url || !/^https:\/\/www\.bolha\.com\/.+/i.test(String(url))) {
    throw new Error("Osvezevanje je dovoljeno samo za varne Bolha URL-je.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("Osveževanje je poteklo med nalaganjem najnovejšega oglasa.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404 || response.status === 410) {
    return {
      id: getListingId(url),
      url: normalizeUrl(url),
      title: "Bolha oglas",
      price: null,
      priceText: "Oglas ni na voljo",
      currency: "EUR",
      imageUrl: null,
      sellerName: null,
      sellerProfileUrl: null,
      categoryLabel: null,
      categoryPath: [],
      available: false,
      isDetected: true
    };
  }

  if (!response.ok) {
    throw new Error(`Bolha je vrnila stanje ${response.status}.`);
  }

  if (!/^https:\/\/www\.bolha\.com\//i.test(String(response.url || url))) {
    throw new Error("Neveljavna preusmeritev pri osveževanju oglasa.");
  }

  const html = await response.text();
  const listing = extractListingFromHtml(html, url);

  if (!listing.isDetected) {
    throw new Error("Najnovejših podatkov oglasa z Bolhe ni bilo mogoče razbrati.");
  }

  return listing;
}

async function notifyPriceDrop(item, settings) {
  const locale = settings.locale;
  const title = getMessage("notificationTitleDrop", locale);
  const message = getNotificationMessage(
    item.title || "Spremljani oglas na Bolhi",
    formatCurrency(item.lastPrice, item.currency),
    formatCurrency(item.currentPrice, item.currency),
    locale
  );

  await chrome.notifications.create(`price-drop-${item.id}-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2
  });
}

function getSellerAlertReason(previousItem, nextItem) {
  if (!previousItem || !nextItem || !previousItem.sellerAlertEnabled || nextItem.lastError) {
    return null;
  }

  if (previousItem.sellerName && nextItem.sellerName && previousItem.sellerName !== nextItem.sellerName) {
    return "sellerChanged";
  }

  if (previousItem.status !== nextItem.status && nextItem.status === "unavailable") {
    return "unavailable";
  }

  if (nextItem.status === "dropped" && previousItem.currentPrice != null && nextItem.currentPrice != null && nextItem.currentPrice < previousItem.currentPrice) {
    return "drop";
  }

  return null;
}

async function notifySellerAlert(item, previousItem, reason, settings) {
  const locale = settings.locale;
  const sellerName = item.sellerName || previousItem.sellerName || getMessage("sellerUnknown", locale);
  let message = getMessage("notificationSellerChanged", locale, [sellerName, item.title || "Spremljani oglas"]);

  if (reason === "drop") {
    message = getMessage(
      "notificationSellerDrop",
      locale,
      [
        sellerName,
        item.title || "Spremljani oglas",
        formatCurrency(item.currentPrice, item.currency)
      ]
    );
  }

  if (reason === "unavailable") {
    message = getMessage("notificationSellerUnavailable", locale, [sellerName, item.title || "Spremljani oglas"]);
  }

  await chrome.notifications.create(`seller-alert-${item.id}-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: getMessage("notificationTitleSeller", locale),
    message,
    priority: 1
  });
}

function chunkText(text, size = SYNC_BACKUP_CHUNK_SIZE) {
  const chunks = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks;
}

async function getSyncBackupStatus() {
  const stored = await chrome.storage.sync.get(SYNC_BACKUP_META_KEY);
  return stored[SYNC_BACKUP_META_KEY] || null;
}

async function createSafetyBackupSnapshot(reason) {
  const settings = await getSettings();
  const items = await getTrackedListings();
  const snapshot = {
    ...createExportPayload(items, settings),
    backupReason: reason || "manual"
  };

  await chrome.storage.local.set({
    [LOCAL_SAFETY_BACKUP_KEY]: snapshot
  });

  return snapshot;
}

async function createSyncBackup() {
  const settings = await getSettings();
  const entitlement = await getEntitlementState();
  const access = getFeatureAvailability(PREMIUM_FEATURES.CLOUD_BACKUP, entitlement);

  if (!access.allowed) {
    throw new Error(getPremiumErrorMessage(PREMIUM_FEATURES.CLOUD_BACKUP, settings.locale));
  }

  const items = await getTrackedListings();
  const payload = createExportPayload(items, settings);
  const serialized = JSON.stringify(payload);
  const byteLength = new TextEncoder().encode(serialized).length;

  if (byteLength > 95000) {
    throw new Error("Varnostna kopija je prevelika za shrambo Chrome Sync.");
  }

  const chunks = chunkText(serialized);
  const meta = {
    exportedAt: Date.now(),
    itemCount: items.length,
    chunkCount: chunks.length,
    byteLength
  };
  const syncPayload = {
    [SYNC_BACKUP_META_KEY]: meta
  };
  const previousMeta = await getSyncBackupStatus();

  chunks.forEach((chunk, index) => {
    syncPayload[`${SYNC_BACKUP_CHUNK_PREFIX}${index}`] = chunk;
  });

  await chrome.storage.sync.set(syncPayload);

  if (previousMeta && previousMeta.chunkCount > chunks.length) {
    const staleKeys = Array.from(
      { length: previousMeta.chunkCount - chunks.length },
      (_, index) => `${SYNC_BACKUP_CHUNK_PREFIX}${chunks.length + index}`
    );
    await chrome.storage.sync.remove(staleKeys);
  }

  return {
    ok: true,
    meta
  };
}

async function restoreSyncBackup() {
  const settings = await getSettings();
  const entitlement = await getEntitlementState();
  const access = getFeatureAvailability(PREMIUM_FEATURES.CLOUD_BACKUP, entitlement);

  if (!access.allowed) {
    throw new Error(getPremiumErrorMessage(PREMIUM_FEATURES.CLOUD_BACKUP, settings.locale));
  }

  const meta = await getSyncBackupStatus();

  if (!meta || !meta.chunkCount) {
    throw new Error("V Chrome Sync ni najdene varnostne kopije.");
  }

  const keys = Array.from({ length: meta.chunkCount }, (_, index) => `${SYNC_BACKUP_CHUNK_PREFIX}${index}`);
  const storedChunks = await chrome.storage.sync.get(keys);
  const serialized = keys.map((key) => storedChunks[key] || "").join("");

  if (!serialized) {
    throw new Error("Podatki varnostne kopije v oblaku niso popolni.");
  }

  const imported = normalizeImportPayload(JSON.parse(serialized));
  const nextSettings = clampSettingsToEntitlement(imported.settings || await getSettings(), entitlement);
  const nextItems = imported.items;

  await createSafetyBackupSnapshot("before_sync_restore");
  await saveTrackedListings(nextItems);
  await saveSettings(nextSettings);
  await scheduleRefreshAlarm(nextSettings);
  await updateBadge(nextItems, nextSettings);

  return {
    ok: true,
    settings: nextSettings,
    items: nextItems,
    meta
  };
}

async function performTrackedRefresh(currentItem, settings) {
  let nextItem;

  try {
    const latestListing = await fetchListingSnapshot(currentItem.url);
    const merged = mergeTrackedListing(currentItem, latestListing);
    nextItem = applyScheduledMetadata(currentItem, merged, settings);
  } catch (error) {
    nextItem = createRefreshFailureItem(currentItem, error, settings);
  }

  const shouldNotify = shouldNotifyPriceDrop(currentItem, nextItem, settings);
  const sellerAlertReason = getSellerAlertReason(currentItem, nextItem);
  return {
    previousItem: currentItem,
    item: shouldNotify ? markDropNotificationSent(nextItem) : nextItem,
    shouldNotify,
    sellerAlertReason
  };
}

async function runWithConcurrency(items, worker, limit = MAX_PARALLEL_REFRESHES) {
  const queue = Array.isArray(items) ? items.slice() : [];
  const concurrency = Math.max(1, Math.min(limit, queue.length || 1));
  const results = [];

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const currentItem = queue.shift();

        if (!currentItem) {
          return;
        }

        results.push(await worker(currentItem));
      }
    })
  );

  return results;
}

async function addTrackedListing(payload) {
  const existing = await findTrackedListingByUrl(payload.url);

  if (existing) {
    return {
      ok: true,
      status: "duplicate",
      item: existing
    };
  }

  const settings = await getSettings();
  const items = await getTrackedListings();
  const entitlement = await getEntitlementState();
  const trackedAccess = getFeatureAvailability(PREMIUM_FEATURES.TRACKED_LISTINGS, entitlement, {
    trackedCount: items.length
  });

  if (!trackedAccess.allowed) {
    return createPremiumError(
      getPremiumErrorMessage(PREMIUM_FEATURES.TRACKED_LISTINGS, settings.locale, trackedAccess.limit),
      PREMIUM_FEATURES.TRACKED_LISTINGS,
      trackedAccess.limit
    );
  }

  const trackedItem = createTrackedListing(payload, settings);
  const nextItems = [trackedItem, ...items];
  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);

  return {
    ok: true,
    status: "added",
    item: trackedItem
  };
}

async function refreshTrackedListing(id) {
  const settings = await getSettings();
  const items = await getTrackedListings();
  const currentItem = items.find((item) => item.id === id);

  if (!currentItem) {
    throw new Error("Spremljanega oglasa ni bilo mogoče najti.");
  }

  const { item: finalItem, shouldNotify, sellerAlertReason } = await performTrackedRefresh(currentItem, settings);
  const nextItems = items.map((item) => (item.id === id ? normalizeStoredListing(finalItem) : item));

  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);

  if (shouldNotify) {
    await notifyPriceDrop(finalItem, settings);
  }

  if (sellerAlertReason) {
    await notifySellerAlert(finalItem, currentItem, sellerAlertReason, settings);
  }

  return {
    ok: true,
    item: finalItem
  };
}

async function refreshDueListings() {
  const settings = await getSettings();
  const items = await getTrackedListings();
  const dueItems = items
    .filter((item) => item.nextCheckAt == null || item.nextCheckAt <= Date.now())
    .slice(0, 12);

  if (!dueItems.length) {
    await updateBadge(items, settings);
    return {
      ok: true,
      refreshed: 0
    };
  }

  const refreshResults = await runWithConcurrency(dueItems, (item) => performTrackedRefresh(item, settings));
  const refreshedById = new Map(refreshResults.map((result) => [result.item.id, normalizeStoredListing(result.item)]));
  const nextItems = items.map((item) => refreshedById.get(item.id) || item);

  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);
  await Promise.all(
    refreshResults
      .filter((result) => result.shouldNotify)
      .map((result) => notifyPriceDrop(result.item, settings))
  );
  await Promise.all(
    refreshResults
      .filter((result) => result.sellerAlertReason)
      .map((result) => notifySellerAlert(result.item, result.previousItem, result.sellerAlertReason, settings))
  );

  return {
    ok: true,
    refreshed: dueItems.length
  };
}

async function updateTrackedListingMeta(payload) {
  const settings = await getSettings();
  const entitlement = await getEntitlementState();
  const wantsNotes = Boolean((payload && payload.notes) || (payload && payload.tags));
  const wantsSellerAlert = Boolean(payload && payload.sellerAlertEnabled);

  if (wantsNotes || wantsSellerAlert) {
    const feature = wantsSellerAlert ? PREMIUM_FEATURES.SELLER_ALERTS : PREMIUM_FEATURES.ADVANCED_NOTES;
    const access = getFeatureAvailability(feature, entitlement);

    if (!access.allowed) {
      return createPremiumError(
        getPremiumErrorMessage(feature, settings.locale),
        feature
      );
    }
  }

  const items = await getTrackedListings();
  const nextItems = items.map((item) => {
    if (item.id !== payload.id) {
      return item;
    }

    return normalizeStoredListing({
      ...item,
      notes: payload.notes || "",
      tags: normalizeTags(payload.tags),
      sellerAlertEnabled: payload && Object.prototype.hasOwnProperty.call(payload, "sellerAlertEnabled")
        ? Boolean(payload.sellerAlertEnabled)
        : item.sellerAlertEnabled
    });
  });

  const updatedItem = nextItems.find((item) => item.id === payload.id) || null;
  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);

  return {
    ok: true,
    item: updatedItem
  };
}

async function removeListingById(id) {
  const settings = await getSettings();
  const items = await removeTrackedListing(id);
  await updateBadge(items, settings);
  return {
    ok: true,
    items
  };
}

async function markRecentDropsSeen() {
  const settings = await getSettings();
  const items = await getTrackedListings();
  const nextItems = markDropsSeen(items);
  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);
  return {
    ok: true,
    items: nextItems
  };
}

async function handleGetSettings() {
  const settings = await getSettings();
  return {
    ok: true,
    settings
  };
}

async function handleUpdateSettings(payload) {
  const entitlement = await getEntitlementState();
  const nextSettings = await saveSettings(clampSettingsToEntitlement(payload, entitlement));
  const items = await getTrackedListings();
  const hydratedItems = items.map((item) => {
    if (!nextSettings.scheduledRefreshEnabled) {
      return normalizeStoredListing({
        ...item,
        nextCheckAt: null
      });
    }

    if (item.nextCheckAt != null) {
      return item;
    }

    return normalizeStoredListing({
      ...item,
      nextCheckAt: Date.now() + nextSettings.refreshIntervalMinutes * 60000
    });
  });

  await saveTrackedListings(hydratedItems);
  await scheduleRefreshAlarm(nextSettings);
  await updateBadge(hydratedItems, nextSettings);

  return {
    ok: true,
    settings: nextSettings
  };
}

async function handleExportData() {
  const settings = await getSettings();
  const items = await getTrackedListings();

  return {
    ok: true,
    payload: createExportPayload(items, settings)
  };
}

async function handleImportData(payload) {
  const currentSettings = await getSettings();
  const entitlement = await getEntitlementState();
  const currentItems = await getTrackedListings();
  const imported = normalizeImportPayload(payload && payload.data);
  const mode = payload && payload.mode === "replace" ? "replace" : "merge";
  const nextItems = mergeImportedData(currentItems, imported.items, mode);
  const nextSettings = mode === "replace"
    ? (imported.settings || currentSettings)
    : {
        ...currentSettings,
        ...(imported.settings || {})
      };

  if (mode === "replace") {
    await createSafetyBackupSnapshot("before_import_replace");
  }

  const normalizedSettings = clampSettingsToEntitlement(nextSettings, entitlement);
  await saveTrackedListings(nextItems);
  await saveSettings(normalizedSettings);
  await scheduleRefreshAlarm(normalizedSettings);
  await updateBadge(nextItems, normalizedSettings);

  return {
    ok: true,
    items: nextItems,
    settings: normalizedSettings,
    importedCount: imported.items.length
  };
}

async function handleGetSyncBackupStatus() {
  return {
    ok: true,
    meta: await getSyncBackupStatus()
  };
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrapBackgroundState().catch((error) => {
    console.error("Failed to bootstrap background state after install.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  bootstrapBackgroundState().catch((error) => {
    console.error("Failed to bootstrap background state on startup.", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === ALARM_NAME) {
    refreshDueListings().catch((error) => {
      console.error("Scheduled refresh failed.", error);
    });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "refresh_due_listings") {
    getSettings()
      .then(async (settings) => {
        const entitlement = await getEntitlementState();
        const access = getFeatureAvailability(PREMIUM_FEATURES.BULK_REFRESH, entitlement);

        if (!access.allowed) {
          return null;
        }

        return refreshDueListings();
      })
      .catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    sendResponse({
      ok: false,
      error: "Nezaupan vir sporočila."
    });
    return false;
  }

  const validation = validateMessage(message);

  if (!validation.ok) {
    sendResponse({
      ok: false,
      error: validation.error
    });
    return false;
  }

  (async () => {
    if (message.type === MESSAGE_TYPES.ADD_TRACKED_LISTING) {
      if (!message.payload || typeof message.payload.url !== "string") {
        return {
          ok: false,
          error: "Neveljavni podatki oglasa."
        };
      }

      return addTrackedListing(message.payload);
    }

    if (message.type === MESSAGE_TYPES.REFRESH_TRACKED_LISTING) {
      if (!message.payload || typeof message.payload.id !== "string") {
        return {
          ok: false,
          error: "Neveljaven identifikator oglasa."
        };
      }

      return refreshTrackedListing(message.payload.id);
    }

    if (message.type === MESSAGE_TYPES.REMOVE_TRACKED_LISTING) {
      if (!message.payload || typeof message.payload.id !== "string") {
        return {
          ok: false,
          error: "Neveljaven identifikator oglasa."
        };
      }

      return removeListingById(message.payload.id);
    }

    if (message.type === MESSAGE_TYPES.UPDATE_TRACKED_LISTING_META) {
      if (!message.payload || typeof message.payload.id !== "string") {
        return {
          ok: false,
          error: "Neveljavni podatki za posodobitev."
        };
      }

      return updateTrackedListingMeta(message.payload);
    }

    if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
      return handleGetSettings();
    }

    if (message.type === MESSAGE_TYPES.UPDATE_SETTINGS) {
      if (!isPlainObject(message.payload)) {
        return {
          ok: false,
          error: "Neveljavne nastavitve."
        };
      }

      return handleUpdateSettings(message.payload);
    }

    if (message.type === MESSAGE_TYPES.MARK_DROPS_SEEN) {
      return markRecentDropsSeen();
    }

    if (message.type === MESSAGE_TYPES.EXPORT_TRACKED_DATA) {
      return handleExportData();
    }

    if (message.type === MESSAGE_TYPES.IMPORT_TRACKED_DATA) {
      if (!message.payload || !["merge", "replace", undefined].includes(message.payload.mode)) {
        return {
          ok: false,
          error: "Neveljavni podatki za uvoz."
        };
      }

      return handleImportData(message.payload);
    }

    if (message.type === MESSAGE_TYPES.REFRESH_DUE_LISTINGS) {
      const settings = await getSettings();
      const entitlement = await getEntitlementState();
      const access = getFeatureAvailability(PREMIUM_FEATURES.BULK_REFRESH, entitlement);

      if (!access.allowed) {
        return createPremiumError(
          getPremiumErrorMessage(PREMIUM_FEATURES.BULK_REFRESH, settings.locale),
          PREMIUM_FEATURES.BULK_REFRESH
        );
      }

      return refreshDueListings();
    }

    if (message.type === MESSAGE_TYPES.CREATE_SYNC_BACKUP) {
      return createSyncBackup();
    }

    if (message.type === MESSAGE_TYPES.RESTORE_SYNC_BACKUP) {
      return restoreSyncBackup();
    }

    if (message.type === MESSAGE_TYPES.GET_SYNC_BACKUP_STATUS) {
      return handleGetSyncBackupStatus();
    }

    if (message.type === MESSAGE_TYPES.CREATE_CHECKOUT_SESSION) {
      return createCheckoutSession();
    }

    if (message.type === MESSAGE_TYPES.SYNC_ENTITLEMENT) {
      return syncEntitlementState({
        force: Boolean(message.payload && message.payload.force)
      });
    }

    if (message.type === MESSAGE_TYPES.RESTORE_PREMIUM_ACCESS) {
      return restorePremiumAccess(message.payload);
    }

    if (message.type === MESSAGE_TYPES.OPEN_EXTENSION_PAGE) {
      return openExtensionPage(message.payload && message.payload.page);
    }

    return {
      ok: false,
      error: "Nepodprta vrsta sporočila."
    };
  })()
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error.message || "Prišlo je do napake."
      })
    );

  return true;
});
