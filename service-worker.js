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
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml"
    }
  });

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
  const title = getMessage("notification_title_drop", locale);
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

  let nextItem;

  try {
    const latestListing = await fetchListingSnapshot(currentItem.url);
    const merged = mergeTrackedListing(currentItem, latestListing);
    nextItem = applyScheduledMetadata(currentItem, merged, settings);
  } catch (error) {
    nextItem = createRefreshFailureItem(currentItem, error, settings);
  }

  const shouldNotify = shouldNotifyPriceDrop(currentItem, nextItem, settings);
  const finalItem = shouldNotify ? markDropNotificationSent(nextItem) : nextItem;
  const nextItems = items.map((item) => (item.id === id ? normalizeStoredListing(finalItem) : item));

  await saveTrackedListings(nextItems);
  await updateBadge(nextItems, settings);

  if (shouldNotify) {
    await notifyPriceDrop(finalItem, settings);
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

  let nextItems = items.slice();

  for (const item of dueItems) {
    const response = await refreshTrackedListing(item.id);
    nextItems = nextItems.map((entry) => (entry.id === item.id ? normalizeStoredListing(response.item) : entry));
  }

  await updateBadge(nextItems, settings);

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
      tags: normalizeTags(payload.tags)
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
