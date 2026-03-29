importScripts("utils.js", "i18n.js");

const {
  ALARM_NAME,
  MESSAGE_TYPES,
  createExportPayload,
  createRefreshFailureItem,
  createTrackedListing,
  extractListingFromHtml,
  findTrackedListingByUrl,
  formatCurrency,
  getListingId,
  getSettings,
  getPriceAnalytics,
  getTrackedListings,
  getUnseenDropCount,
  markDropNotificationSent,
  markDropsSeen,
  mergeImportedData,
  mergeTrackedListing,
  normalizeImportPayload,
  normalizeStoredListing,
  normalizeTags,
  normalizeUrl,
  removeTrackedListing,
  saveSettings,
  saveTrackedListings,
  shouldNotifyPriceDrop,
  applyScheduledMetadata
} = globalThis.BolhaTrackerUtils;

const {
  getMessage,
  getNotificationMessage
} = globalThis.BolhaTrackerI18n;

const FETCH_TIMEOUT_MS = 15000;
const MAX_PARALLEL_REFRESHES = 3;
const SYNC_BACKUP_META_KEY = "cloudBackupMeta";
const SYNC_BACKUP_CHUNK_PREFIX = "cloudBackupChunk_";
const SYNC_BACKUP_CHUNK_SIZE = 7000;

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

async function bootstrapBackgroundState() {
  const settings = await getSettings();
  const items = await getTrackedListings();
  await scheduleRefreshAlarm(settings);
  await updateBadge(items, settings);
}

async function fetchListingSnapshot(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("Refresh timed out while loading the latest listing.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404 || response.status === 410) {
    return {
      id: getListingId(url),
      url: normalizeUrl(url),
      title: "Bolha listing",
      price: null,
      priceText: "Listing unavailable",
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
    throw new Error(`Bolha returned ${response.status}.`);
  }

  const html = await response.text();
  const listing = extractListingFromHtml(html, url);

  if (!listing.isDetected) {
    throw new Error("Could not parse the latest listing data from Bolha.");
  }

  return listing;
}

async function notifyPriceDrop(item, settings) {
  const locale = settings.locale;
  const title = getMessage("notificationTitleDrop", locale);
  const message = getNotificationMessage(
    item.title || "Tracked Bolha listing",
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
  let message = getMessage("notificationSellerChanged", locale, [sellerName, item.title || "Tracked listing"]);

  if (reason === "drop") {
    message = getMessage(
      "notificationSellerDrop",
      locale,
      [
        sellerName,
        item.title || "Tracked listing",
        formatCurrency(item.currentPrice, item.currency)
      ]
    );
  }

  if (reason === "unavailable") {
    message = getMessage("notificationSellerUnavailable", locale, [sellerName, item.title || "Tracked listing"]);
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

async function createSyncBackup() {
  const settings = await getSettings();
  const items = await getTrackedListings();
  const payload = createExportPayload(items, settings);
  const serialized = JSON.stringify(payload);
  const byteLength = new TextEncoder().encode(serialized).length;

  if (byteLength > 95000) {
    throw new Error("Cloud backup is too large for Chrome sync storage.");
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

  chunks.forEach((chunk, index) => {
    syncPayload[`${SYNC_BACKUP_CHUNK_PREFIX}${index}`] = chunk;
  });

  const previousMeta = await getSyncBackupStatus();
  if (previousMeta && previousMeta.chunkCount) {
    const oldKeys = Array.from({ length: previousMeta.chunkCount }, (_, index) => `${SYNC_BACKUP_CHUNK_PREFIX}${index}`);
    await chrome.storage.sync.remove(oldKeys);
  }

  await chrome.storage.sync.set(syncPayload);

  return {
    ok: true,
    meta
  };
}

async function restoreSyncBackup() {
  const meta = await getSyncBackupStatus();

  if (!meta || !meta.chunkCount) {
    throw new Error("No cloud backup found in Chrome sync.");
  }

  const keys = Array.from({ length: meta.chunkCount }, (_, index) => `${SYNC_BACKUP_CHUNK_PREFIX}${index}`);
  const storedChunks = await chrome.storage.sync.get(keys);
  const serialized = keys.map((key) => storedChunks[key] || "").join("");

  if (!serialized) {
    throw new Error("Cloud backup data is incomplete.");
  }

  const imported = normalizeImportPayload(JSON.parse(serialized));
  const nextSettings = imported.settings || await getSettings();
  const nextItems = imported.items;

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
    throw new Error("Tracked listing not found.");
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
  const nextSettings = await saveSettings(payload);
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

  await saveTrackedListings(nextItems);
  await saveSettings(nextSettings);
  await scheduleRefreshAlarm(nextSettings);
  await updateBadge(nextItems, nextSettings);

  return {
    ok: true,
    items: nextItems,
    settings: nextSettings,
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
  bootstrapBackgroundState();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrapBackgroundState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === ALARM_NAME) {
    refreshDueListings();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "refresh_due_listings") {
    refreshDueListings().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  (async () => {
    if (message.type === MESSAGE_TYPES.ADD_TRACKED_LISTING) {
      return addTrackedListing(message.payload);
    }

    if (message.type === MESSAGE_TYPES.REFRESH_TRACKED_LISTING) {
      return refreshTrackedListing(message.payload.id);
    }

    if (message.type === MESSAGE_TYPES.REMOVE_TRACKED_LISTING) {
      return removeListingById(message.payload.id);
    }

    if (message.type === MESSAGE_TYPES.UPDATE_TRACKED_LISTING_META) {
      return updateTrackedListingMeta(message.payload);
    }

    if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
      return handleGetSettings();
    }

    if (message.type === MESSAGE_TYPES.UPDATE_SETTINGS) {
      return handleUpdateSettings(message.payload);
    }

    if (message.type === MESSAGE_TYPES.MARK_DROPS_SEEN) {
      return markRecentDropsSeen();
    }

    if (message.type === MESSAGE_TYPES.EXPORT_TRACKED_DATA) {
      return handleExportData();
    }

    if (message.type === MESSAGE_TYPES.IMPORT_TRACKED_DATA) {
      return handleImportData(message.payload);
    }

    if (message.type === MESSAGE_TYPES.REFRESH_DUE_LISTINGS) {
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

    return {
      ok: false,
      error: "Unsupported message type."
    };
  })()
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error.message || "Something went wrong."
      })
    );

  return true;
});
