(function initBolhaTrackerI18n(global) {
  const { STATUS, formatCurrency } = global.BolhaTrackerUtils || {};

  const MESSAGES = {
    en: {
      appTitle: "BOLHA Price Tracker",
      byline: "by FlegarTech",
      subtitle: "Track Bolha listing prices locally and catch drops before they disappear.",
      badgeMvp: "MVP",
      themeDark: "Night",
      themeLight: "Day",
      themeDarkTitle: "Switch to dark mode",
      themeLightTitle: "Switch to light mode",
      watchlistToolsKicker: "Command deck",
      watchlistToolsTitle: "Watchlist controls",
      watchlistToolsSubtitle: "Search faster, focus what matters, and refresh only the listings that need attention.",
      watchlistSearchLabel: "Search watchlist",
      watchlistSearchPlaceholder: "Search title, seller, notes, or tags",
      watchlistSortLabel: "Sort by",
      currentPageKicker: "Live capture",
      quickSettingsKicker: "Automation",
      trackedListingsKicker: "Watchlist",
      guideKicker: "Flow",
      guideSubtitle: "The extension is designed to stay out of the way while keeping your local watchlist tidy.",
      onboardingKicker: "Welcome",
      currentPageTitle: "Current page",
      currentPageSubtitle: "Track the listing you are viewing right now.",
      trackedTitle: "Tracked listings",
      trackedSubtitle: "Refresh items, review trends, and keep your watchlist tidy.",
      trackedFilteredSubtitle: "$1 of $2 listings shown.",
      footerPrivacy: "Local-only tracker. No data leaves your browser.",
      openBolhaListing: "Open a Bolha listing page",
      openBolhaDesc: "Visit a real product page on Bolha.com and the tracker will detect it here.",
      pageNotTrackable: "This page is not trackable",
      pageNotTrackableDesc: "Open a listing page with an ad URL on Bolha to save and monitor a product.",
      noTrackedTitle: "No tracked listings yet",
      noTrackedDesc: "Track your first Bolha product from a listing page and it will show up here with trends, tags, and status updates.",
      noMatchesTitle: "No listings match this view",
      noMatchesDesc: "Try another filter or clear the search to see more of your tracked listings.",
      bolhaListing: "Bolha listing",
      sellerUnknown: "Seller not detected",
      categoryUnknown: "Category not detected",
      listingUnavailableHint: "Bolha marks this listing as unavailable, so it cannot be added right now.",
      alreadyTrackedHint: "This listing is already in your tracked collection.",
      readyTrackHint: "Save this listing locally and compare its price automatically over time.",
      trackListing: "Track this listing",
      alreadyTracked: "Already tracked",
      listingUnavailable: "Listing unavailable",
      openLink: "Open",
      settingsLink: "Settings",
      donateLink: "Donate",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      remove: "Remove",
      saveDetails: "Save details",
      notesLabel: "Notes",
      tagsLabel: "Tags",
      notesPlaceholder: "Add a private note for this listing",
      tagsPlaceholder: "desk, urgent, reseller",
      summaryTracked: "Tracked",
      summaryTrackedDetail: "Local watchlist",
      summaryDrops: "Recent drops",
      summaryDropsActive: "Needs review",
      summaryDropsQuiet: "All quiet",
      summaryDue: "Due now",
      summaryDueDetail: "Ready to refresh",
      summarySchedule: "Schedule",
      summaryScheduleDetail: "Background checks",
      scheduleOff: "Off",
      nextCheck: "Next check",
      trend: "Trend",
      attentionLabel: "Drop",
      hideDetails: "Hide details",
      notesAndTags: "Notes and tags",
      sellerAlertToggle: "Notify me about seller-level changes for this listing",
      sellerAlertShort: "Seller alert",
      guideTitle: "How this works",
      guideStep1: "Open a Bolha listing.",
      guideStep2: "Click Track this listing.",
      guideStep3: "Come back later or wait for an automatic check.",
      guideStep4: "You get a Chrome notification when a newly lower price is detected.",
      onboardingTitle: "Welcome to your price tracker",
      onboardingCopy: "This extension tracks Bolha listings locally, rechecks prices later, and notifies you when a tracked price drops.",
      onboardingDismiss: "Got it",
      onboardingOpenSettings: "Open settings",
      donateMissing: "Donate link is not configured yet.",
      roadmapTitle: "V3 roadmap",
      roadmapFunctionality: "Functionality",
      roadmapFunctionalityCopy: "Cloud sync, optional account login, email alerts, shared watchlists, richer price analytics, category-specific filters, and seller-level alerts.",
      roadmapDesign: "Design",
      roadmapDesignCopy: "Cleaner typography, better spacing, faster scanability, stronger empty and success states, and a compact mode for heavy users.",
      roadmapEase: "Ease of use",
      roadmapEaseCopy: "Smarter onboarding, bulk actions, simpler import/export, easier notification controls, and clearer status explanations.",
      optionsTitle: "Tracker settings",
      optionsSubtitle: "Tune automatic refreshes, notifications, and maintenance tools for your local watchlist.",
      settingsSection: "Settings",
      refreshFrequency: "Refresh frequency",
      refreshHelp: "Scheduled refreshes run in the background using chrome.alarms.",
      scheduledRefresh: "Enable scheduled background refresh",
      notificationsEnabled: "Notify me about newly detected drops",
      badgeCount: "Show badge count for unseen drops",
      language: "Language",
      saveSettings: "Save settings",
      settingsSavedState: "Saved",
      saveViewPreset: "Save view",
      exportTitle: "Export",
      exportDesc: "Download your tracked listings, notes, tags, and settings as a JSON backup.",
      exportButton: "Export data",
      importTitle: "Import",
      importDesc: "Import a backup file and merge it into your current local data or replace everything.",
      importMode: "Import mode",
      importMerge: "Merge with current data",
      importReplace: "Replace current data",
      chooseFile: "Choose JSON file",
      importButton: "Import data",
      diagnosticsTitle: "Selector diagnostics",
      diagnosticsDesc: "Review the Bolha selectors in use and inspect extraction results from the active tab.",
      runDiagnostics: "Run diagnostics on active tab",
      selectorConfig: "Selector config",
      diagnosticResult: "Active tab result",
      diagnosticsHints: "Extraction hints",
      diagnosticsMissing: "Missing fields",
      diagnosticsOk: "Listing data detected successfully.",
      diagnosticsNotBolha: "Open a Bolha listing in the active tab to run diagnostics.",
      diagnosticsNoTab: "No active tab available.",
      localeAuto: "Auto",
      localeEn: "English",
      localeSl: "Slovenian",
      sortrecent: "Newest first",
      sortlastChecked: "Recently checked",
      sortbiggestDrop: "Biggest drop",
      sortpriceLow: "Lowest price",
      sorttitle: "Title A-Z",
      sortoldest: "Oldest first",
      filterall: "All",
      filterdrops: "Drops",
      filterdue: "Due",
      filterunavailable: "Unavailable",
      filternotes: "Notes",
      interval30: "Every 30 minutes",
      interval60: "Every hour",
      interval180: "Every 3 hours",
      interval360: "Every 6 hours",
      interval720: "Every 12 hours",
      interval1440: "Every day",
      checkedJustNow: "Checked just now",
      checkedMinutesAgo: "Checked $1m ago",
      checkedHoursAgo: "Checked $1h ago",
      checkedDaysAgo: "Checked $1d ago",
      neverChecked: "Never checked",
      dueNow: "Due now",
      inMinutes: "in $1m",
      inHours: "in $1h",
      inDays: "in $1d",
      statusUnchanged: "No change",
      statusDropped: "Dropped",
      statusIncreased: "Increased",
      statusUnavailable: "Unavailable",
      shortUnchanged: "Stable",
      shortDropped: "Drop",
      shortIncreased: "Up",
      shortUnavailable: "Offline",
      droppedFromTo: "Dropped from $1 to $2",
      increasedFromTo: "Increased from $1 to $2",
      unavailableSummary: "This listing is unavailable on Bolha. Recovery checks are still scheduled.",
      currentPriceSummary: "Current price: $1",
      deltaVsLast: "$1 vs last check",
      retrySummary: "Retry scheduled $1",
      retryError: "Refresh failed. Retry scheduled $1",
      toastAdded: "Listing added to your tracker.",
      toastDuplicate: "This listing is already being tracked.",
      toastRefreshFailed: "Refresh failed. Last saved data is still available.",
      toastRefreshSuccess: "Listing refreshed.",
      toastPriceDrop: "Price drop detected.",
      toastRemoved: "Listing removed.",
      toastDetailsSaved: "Listing details saved.",
      toastSettingsSaved: "Settings saved.",
      toastDueRefreshed: "Refreshed $1 due listings.",
      toastNothingDue: "No listings needed a refresh.",
      toastOnboardingReset: "Onboarding has been reset.",
      toastCloudBackupSaved: "Cloud backup saved to Chrome sync.",
      toastCloudBackupRestored: "Cloud backup restored.",
      toastPresetSaved: "Saved view added.",
      toastPresetRemoved: "Saved view removed.",
      toastImportFailed: "Import failed. Check the file format and try again.",
      toastImportDone: "Imported $1 listings.",
      openBolhaButton: "Open Bolha",
      refreshDueButton: "Refresh due ($1)",
      overviewTitle: "Watchlist overview",
      overviewSubtitle: "Keep an eye on watchlist health, due checks, and the next moment that needs attention.",
      actionsTitle: "Quick actions",
      actionsSubtitle: "Run maintenance tasks without leaving the settings page.",
      refreshDueAction: "Refresh due listings",
      resetOnboarding: "Show onboarding again",
      cloudTitle: "Cloud backup",
      cloudSubtitle: "Create an optional backup in Chrome sync so your watchlist can be restored later on the same signed-in browser profile.",
      cloudBackupButton: "Back up to Chrome sync",
      cloudRestoreButton: "Restore from Chrome sync",
      cloudStatusReady: "Backup ready",
      cloudStatusItems: "$1 tracked listings stored.",
      cloudStatusDate: "Last backup: $1",
      cloudStatusEmpty: "No backup yet",
      cloudStatusEmptyCopy: "Create your first optional cloud backup from this page.",
      presetsTitle: "Saved presets",
      presetsSubtitle: "Keep your favorite watchlist views ready for the popup command deck.",
      analyticsTitle: "Price analytics",
      analyticsSubtitle: "Review a larger price chart and quick metrics for any tracked listing.",
      analyticsSelectLabel: "Tracked listing",
      analyticsChartTitle: "Price history",
      analyticsMetricsTitle: "Metrics",
      analyticsSamples: "Samples",
      analyticsLow: "Lowest price",
      analyticsHigh: "Highest price",
      analyticsAverage: "Average",
      analyticsChange: "Net change",
      analyticsEmpty: "More refresh history is needed before analytics can be shown.",
      shortcutsTitle: "Keyboard shortcuts",
      shortcutOpenPopup: "Open popup: Ctrl/Cmd + Shift + B",
      shortcutRefreshDue: "Refresh due listings: Ctrl/Cmd + Shift + Y",
      panelExpand: "Expand panel",
      panelMinimize: "Minimize panel",
      closeLabel: "Close",
      presetEmpty: "No saved views yet.",
      presetPrompt: "Name this saved watchlist view",
      notificationTitleDrop: "Price dropped on Bolha!",
      notificationTitleSeller: "Seller alert on Bolha",
      notificationBodyDrop: "$1: $2 -> $3",
      notificationSellerDrop: "$1 changed $2 to $3.",
      notificationSellerUnavailable: "$1 listing $2 is now unavailable.",
      notificationSellerChanged: "$2 now points to seller $1.",
      exportFilename: "bolha-price-tracker-export",
      diagTitleField: "Title",
      diagPriceField: "Price",
      diagSellerField: "Seller",
      diagCategoryField: "Category",
      diagStatusField: "Status"
    },
    sl: {
      appTitle: "BOLHA Price Tracker",
      byline: "od FlegarTech",
      subtitle: "Spremljajte cene oglasov na Bolhi lokalno in ujmite padce, preden izginejo.",
      badgeMvp: "MVP",
      currentPageTitle: "Trenutna stran",
      currentPageSubtitle: "Spremljajte oglas, ki ga gledate zdaj.",
      trackedTitle: "Spremljani oglasi",
      trackedSubtitle: "Osvežite oglase, preverite trend in uredite svojo listo.",
      footerPrivacy: "Samo lokalno. Noben podatek ne zapusti vasega brskalnika.",
      openBolhaListing: "Odprite oglas na Bolhi",
      openBolhaDesc: "Odprite pravo stran oglasa na Bolha.com in sledilnik ga bo zaznal tukaj.",
      pageNotTrackable: "Ta stran ni primerna za sledenje",
      pageNotTrackableDesc: "Odprite stran oglasa z URL-jem oglasa na Bolhi, da ga lahko spremljate.",
      noTrackedTitle: "Še ni spremljanih oglasov",
      noTrackedDesc: "Dodajte prvi oglas z Bolhe in tukaj boste videli trend, oznake in spremembe stanja.",
      bolhaListing: "Bolha oglas",
      sellerUnknown: "Prodajalec ni zaznan",
      categoryUnknown: "Kategorija ni zaznana",
      listingUnavailableHint: "Bolha označuje ta oglas kot nedosegljiv, zato ga trenutno ni mogoče dodati.",
      alreadyTrackedHint: "Ta oglas je ze na vasem seznamu spremljanja.",
      readyTrackHint: "Shranite oglas lokalno in samodejno primerjajte ceno skozi cas.",
      trackListing: "Spremljaj ta oglas",
      alreadyTracked: "Že spremljan",
      listingUnavailable: "Oglas ni na voljo",
      openLink: "Odpri",
      settingsLink: "Nastavitve",
      donateLink: "Doniraj",
      refresh: "Osveži",
      refreshing: "Osvežujem...",
      remove: "Odstrani",
      saveDetails: "Shrani podrobnosti",
      notesLabel: "Opombe",
      tagsLabel: "Oznake",
      notesPlaceholder: "Dodajte zasebno opombo za ta oglas",
      tagsPlaceholder: "pisarna, nujno, preprodaja",
      summaryTracked: "Spremljano",
      summaryDrops: "Novi padci",
      summarySchedule: "Urnik",
      scheduleOff: "Izklopljeno",
      nextCheck: "Naslednji pregled",
      trend: "Trend",
      guideTitle: "Kako to deluje",
      guideStep1: "Odprite Bolha oglas.",
      guideStep2: "Kliknite Spremljaj ta oglas.",
      guideStep3: "Kasneje se vrnite ali počakajte na samodejni pregled.",
      guideStep4: "Ko je zaznana nova nižja cena, dobite Chrome obvestilo.",
      onboardingTitle: "Dobrodošli v sledilnik cen",
      onboardingCopy: "Ta razširitev lokalno spremlja Bolha oglase, kasneje ponovno preveri cene in vas obvesti, ko zazna nov padec cene.",
      onboardingDismiss: "Razumem",
      onboardingOpenSettings: "Odpri nastavitve",
      donateMissing: "Povezava za donacijo se ni nastavljena.",
      roadmapTitle: "V3 načrt",
      roadmapFunctionality: "Funkcionalnost",
      roadmapFunctionalityCopy: "Cloud sync, opcijski uporabniški račun, email alerti, deljene watchliste, bogatejša analitika cen, filtri po kategoriji in alerti na nivoju prodajalca.",
      roadmapDesign: "Izgled",
      roadmapDesignCopy: "Čistejša tipografija, boljši razmiki, hitrejša preglednost, močnejši empty in success state-i ter compact mode za power userje.",
      roadmapEase: "Enostavna uporaba",
      roadmapEaseCopy: "Pametnejši onboarding, bulk akcije, lažji import/export, bolj enostavni notification control-i in jasnejše razlage statusov.",
      optionsTitle: "Nastavitve sledilnika",
      optionsSubtitle: "Uredite samodejno osveževanje, obvestila in vzdrževalna orodja za svojo lokalno listo.",
      settingsSection: "Nastavitve",
      refreshFrequency: "Pogostost osveževanja",
      refreshHelp: "Načrtovana osveževanja tečejo v ozadju prek chrome.alarms.",
      scheduledRefresh: "Omogoči načrtovano osveževanje v ozadju",
      notificationsEnabled: "Obvesti me o na novo zaznanih padcih",
      badgeCount: "Prikaži število neprebranih padcev na ikoni",
      language: "Jezik",
      saveSettings: "Shrani nastavitve",
      exportTitle: "Izvoz",
      exportDesc: "Prenesite spremljane oglase, opombe, oznake in nastavitve kot JSON varnostno kopijo.",
      exportButton: "Izvozi podatke",
      importTitle: "Uvoz",
      importDesc: "Uvozite varnostno kopijo in jo združite s trenutnimi podatki ali jih zamenjajte.",
      importMode: "Način uvoza",
      importMerge: "Združi s trenutnimi podatki",
      importReplace: "Zamenjaj trenutne podatke",
      chooseFile: "Izberi JSON datoteko",
      importButton: "Uvozi podatke",
      diagnosticsTitle: "Diagnostika selektorjev",
      diagnosticsDesc: "Preglejte uporabljene Bolha selektorje in rezultat ekstrakcije z aktivnega zavihka.",
      runDiagnostics: "Zaženi diagnostiko na aktivnem zavihku",
      selectorConfig: "Konfiguracija selektorjev",
      diagnosticResult: "Rezultat aktivnega zavihka",
      diagnosticsHints: "Namigi ekstrakcije",
      diagnosticsMissing: "Manjkajoča polja",
      diagnosticsOk: "Podatki oglasa so bili uspešno zaznani.",
      diagnosticsNotBolha: "Odprite Bolha oglas v aktivnem zavihku za diagnostiko.",
      diagnosticsNoTab: "Ni aktivnega zavihka.",
      localeAuto: "Samodejno",
      localeEn: "Angleščina",
      localeSl: "Slovenščina",
      interval30: "Na 30 minut",
      interval60: "Vsako uro",
      interval180: "Na 3 ure",
      interval360: "Na 6 ur",
      interval720: "Na 12 ur",
      interval1440: "Enkrat na dan",
      checkedJustNow: "Preverjeno pravkar",
      checkedMinutesAgo: "Preverjeno pred $1 min",
      checkedHoursAgo: "Preverjeno pred $1 h",
      checkedDaysAgo: "Preverjeno pred $1 d",
      neverChecked: "Še ni preverjeno",
      dueNow: "Zdaj",
      inMinutes: "čez $1 min",
      inHours: "čez $1 h",
      inDays: "čez $1 d",
      statusUnchanged: "Brez spremembe",
      statusDropped: "Padlo",
      statusIncreased: "Zraslo",
      statusUnavailable: "Nedosegljivo",
      shortUnchanged: "Stabilno",
      shortDropped: "Padec",
      shortIncreased: "Gor",
      shortUnavailable: "Offline",
      droppedFromTo: "Padlo iz $1 na $2",
      increasedFromTo: "Zraslo iz $1 na $2",
      unavailableSummary: "Oglas na Bolhi ni dosegljiv. Preverjanje obnovitve je še vedno načrtovano.",
      currentPriceSummary: "Trenutna cena: $1",
      deltaVsLast: "$1 glede na zadnji pregled",
      retrySummary: "Ponovni poskus je načrtovan $1",
      retryError: "Osvežitev ni uspela. Ponovni poskus je načrtovan $1",
      toastAdded: "Oglas je dodan v sledilnik.",
      toastDuplicate: "Ta oglas je ze v spremljanju.",
      toastRefreshFailed: "Osvežitev ni uspela. Zadnji shranjeni podatki so še vedno na voljo.",
      toastRefreshSuccess: "Oglas je osvežen.",
      toastPriceDrop: "Zaznan je padec cene.",
      toastRemoved: "Oglas je odstranjen.",
      toastDetailsSaved: "Podrobnosti oglasa so shranjene.",
      toastSettingsSaved: "Nastavitve so shranjene.",
      toastImportFailed: "Uvoz ni uspel. Preverite obliko datoteke in poskusite znova.",
      toastImportDone: "Uvozenih oglasov: $1.",
      notificationTitleDrop: "Cena na Bolhi je padla!",
      notificationBodyDrop: "$1: $2 -> $3",
      exportFilename: "bolha-price-tracker-izvoz",
      diagTitleField: "Naslov",
      diagPriceField: "Cena",
      diagSellerField: "Prodajalec",
      diagCategoryField: "Kategorija",
      diagStatusField: "Stanje"
    }
  };

  function resolveLocale(preferredLocale) {
    if (preferredLocale === "sl" || preferredLocale === "en") {
      return preferredLocale;
    }

    const language =
      (global.chrome && global.chrome.i18n && typeof global.chrome.i18n.getUILanguage === "function"
        ? global.chrome.i18n.getUILanguage()
        : global.navigator && global.navigator.language) || "en";

    return String(language).toLowerCase().startsWith("sl") ? "sl" : "en";
  }

  function interpolate(template, substitutions) {
    const values = Array.isArray(substitutions)
      ? substitutions
      : substitutions == null
        ? []
        : [substitutions];

    return values.reduce(
      (result, value, index) => result.replace(new RegExp(`\\$${index + 1}`, "g"), String(value)),
      template
    );
  }

  function getMessage(key, preferredLocale, substitutions) {
    const locale = resolveLocale(preferredLocale);
    const bundle = MESSAGES[locale] || MESSAGES.en;
    return interpolate(bundle[key] || MESSAGES.en[key] || key, substitutions);
  }

  function formatRelativeTime(timestamp, preferredLocale) {
    if (!timestamp) {
      return getMessage("neverChecked", preferredLocale);
    }

    const diffMinutes = Math.round((Date.now() - Number(timestamp)) / 60000);

    if (diffMinutes < 1) {
      return getMessage("checkedJustNow", preferredLocale);
    }

    if (diffMinutes < 60) {
      return getMessage("checkedMinutesAgo", preferredLocale, [diffMinutes]);
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (diffHours < 24) {
      return getMessage("checkedHoursAgo", preferredLocale, [diffHours]);
    }

    return getMessage("checkedDaysAgo", preferredLocale, [Math.round(diffHours / 24)]);
  }

  function formatTimeUntil(timestamp, preferredLocale) {
    if (!timestamp) {
      return getMessage("scheduleOff", preferredLocale);
    }

    const diffMinutes = Math.round((Number(timestamp) - Date.now()) / 60000);

    if (diffMinutes <= 1) {
      return getMessage("dueNow", preferredLocale);
    }

    if (diffMinutes < 60) {
      return getMessage("inMinutes", preferredLocale, [diffMinutes]);
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (diffHours < 24) {
      return getMessage("inHours", preferredLocale, [diffHours]);
    }

    return getMessage("inDays", preferredLocale, [Math.round(diffHours / 24)]);
  }

  function getRefreshFrequencyLabel(minutes, preferredLocale) {
    return getMessage(`interval${Number(minutes)}`, preferredLocale);
  }

  function getStatusLabel(status, preferredLocale) {
    if (status === STATUS.DROPPED) {
      return getMessage("statusDropped", preferredLocale);
    }

    if (status === STATUS.INCREASED) {
      return getMessage("statusIncreased", preferredLocale);
    }

    if (status === STATUS.UNAVAILABLE) {
      return getMessage("statusUnavailable", preferredLocale);
    }

    return getMessage("statusUnchanged", preferredLocale);
  }

  function getStatusShortLabel(status, preferredLocale) {
    if (status === STATUS.DROPPED) {
      return getMessage("shortDropped", preferredLocale);
    }

    if (status === STATUS.INCREASED) {
      return getMessage("shortIncreased", preferredLocale);
    }

    if (status === STATUS.UNAVAILABLE) {
      return getMessage("shortUnavailable", preferredLocale);
    }

    return getMessage("shortUnchanged", preferredLocale);
  }

  function getStatusSummary(item, preferredLocale) {
    if (!item) {
      return "";
    }

    if (item.status === STATUS.DROPPED && item.lastPrice != null && item.currentPrice != null) {
      return getMessage(
        "droppedFromTo",
        preferredLocale,
        [formatCurrency(item.lastPrice, item.currency), formatCurrency(item.currentPrice, item.currency)]
      );
    }

    if (item.status === STATUS.INCREASED && item.lastPrice != null && item.currentPrice != null) {
      return getMessage(
        "increasedFromTo",
        preferredLocale,
        [formatCurrency(item.lastPrice, item.currency), formatCurrency(item.currentPrice, item.currency)]
      );
    }

    if (item.status === STATUS.UNAVAILABLE) {
      return getMessage("unavailableSummary", preferredLocale);
    }

    if (item.currentPrice != null) {
      return getMessage(
        "currentPriceSummary",
        preferredLocale,
        [formatCurrency(item.currentPrice, item.currency)]
      );
    }

    return "";
  }

  function getPriceDifferenceSummary(item, preferredLocale) {
    if (!item || item.lastPrice == null || item.currentPrice == null) {
      return "";
    }

    const delta = item.currentPrice - item.lastPrice;

    if (delta === 0) {
      return "";
    }

    const prefix = delta > 0 ? "+" : "-";
    return getMessage(
      "deltaVsLast",
      preferredLocale,
      [`${prefix}${formatCurrency(Math.abs(delta), item.currency)}`]
    );
  }

  function getRecoverySummary(item, preferredLocale) {
    if (!item) {
      return "";
    }

    if (item.lastError && item.nextCheckAt) {
      return getMessage("retryError", preferredLocale, [formatTimeUntil(item.nextCheckAt, preferredLocale)]);
    }

    if (item.available === false && item.nextCheckAt) {
      return getMessage("retrySummary", preferredLocale, [formatTimeUntil(item.nextCheckAt, preferredLocale)]);
    }

    return "";
  }

  function getNotificationMessage(title, before, after, preferredLocale) {
    return getMessage("notificationBodyDrop", preferredLocale, [title, before, after]);
  }

  global.BolhaTrackerI18n = {
    MESSAGES,
    resolveLocale,
    getMessage,
    formatRelativeTime,
    formatTimeUntil,
    getRefreshFrequencyLabel,
    getStatusLabel,
    getStatusShortLabel,
    getStatusSummary,
    getPriceDifferenceSummary,
    getRecoverySummary,
    getNotificationMessage
  };
})(globalThis);
