(function initBolhaTrackerI18n(global) {
  const { STATUS, formatCurrency } = global.BolhaTrackerUtils || {};

  const BASE_MESSAGES = {
    appTitle: "BOLHA Sledilnik cen",
    byline: "od FlegarTech",
    subtitle: "Lokalno spremljajte cene oglasov na Bolhi in pravočasno opazite padce cen.",
    badgeMvp: "MVP",
    themeDark: "Temno",
    themeLight: "Svetlo",
    themeDarkTitle: "Preklopi na temno temo",
    themeLightTitle: "Preklopi na svetlo temo",
    watchlistToolsKicker: "Nadzor",
    watchlistToolsTitle: "Orodja seznama spremljanja",
    watchlistToolsSubtitle: "Hitreje poiščite oglase, izpostavite pomembne in osvežite samo tiste, ki zahtevajo pozornost.",
    watchlistSearchLabel: "Išči po seznamu spremljanja",
    watchlistSearchPlaceholder: "Išči po naslovu, prodajalcu, opombah ali oznakah",
    watchlistSortLabel: "Razvrsti po",
    currentPageKicker: "Zajem v živo",
    quickSettingsKicker: "Samodejno",
    trackedListingsKicker: "Seznam spremljanja",
    guideKicker: "Potek",
    guideSubtitle: "Razširitev je zasnovana tako, da ostane neopazna, vaš lokalni seznam spremljanja pa ostane urejen.",
    onboardingKicker: "Dobrodošli",
    currentPageTitle: "Trenutna stran",
    currentPageSubtitle: "Spremljajte oglas, ki ga gledate ta trenutek.",
    trackedTitle: "Spremljani oglasi",
    trackedSubtitle: "Osvežite oglase, preverite trende in ohranite seznam pregleden.",
    trackedFilteredSubtitle: "Prikazanih je $1 od $2 oglasov.",
    footerPrivacy: "Samo lokalni sledilnik. Podatki ne zapustijo vašega brskalnika.",
    openBolhaListing: "Odprite oglas na Bolhi",
    openBolhaDesc: "Odprite pravo stran oglasa na Bolha.com in sledilnik ga bo tukaj zaznal.",
    pageNotTrackable: "Te strani ni mogoče spremljati",
    pageNotTrackableDesc: "Odprite stran oglasa z URL-jem oglasa na Bolhi, da ga lahko shranite in spremljate.",
    noTrackedTitle: "Še ni spremljanih oglasov",
    noTrackedDesc: "S prve strani oglasa dodajte svoj prvi izdelek z Bolhe in tukaj boste videli trende, oznake in spremembe stanja.",
    noMatchesTitle: "Noben oglas se ne ujema s trenutnim pogledom",
    noMatchesDesc: "Poskusite drug filter ali počistite iskanje, da prikažete več spremljanih oglasov.",
    bolhaListing: "Bolha oglas",
    sellerUnknown: "Prodajalec ni zaznan",
    categoryUnknown: "Kategorija ni zaznana",
    listingUnavailableHint: "Bolha označuje ta oglas kot nedosegljiv, zato ga trenutno ni mogoče dodati.",
    alreadyTrackedHint: "Ta oglas je že na vašem seznamu spremljanja.",
    readyTrackHint: "Oglas shranite lokalno in sčasoma samodejno primerjajte njegovo ceno.",
    trackListing: "Spremljaj ta oglas",
    alreadyTracked: "Že spremljan",
    listingUnavailable: "Oglas ni na voljo",
    openLink: "Odpri",
    settingsLink: "Nastavitve",
    donateLink: "Podpri projekt",
    refresh: "Osveži",
    refreshing: "Osvežujem ...",
    remove: "Odstrani",
    saveDetails: "Shrani podrobnosti",
    notesLabel: "Opombe",
    tagsLabel: "Oznake",
    notesPlaceholder: "Dodajte zasebno opombo za ta oglas",
    tagsPlaceholder: "miza, nujno, preprodaja",
    summaryTracked: "Spremljano",
    summaryTrackedDetail: "Lokalni seznam",
    summaryDrops: "Nedavni padci",
    summaryDropsActive: "Potrebuje pregled",
    summaryDropsQuiet: "Brez novosti",
    summaryDue: "Na vrsti",
    summaryDueDetail: "Pripravljeno za osvežitev",
    summarySchedule: "Urnik",
    summaryScheduleDetail: "Preverjanje v ozadju",
    scheduleOff: "Izklopljeno",
    nextCheck: "Naslednji pregled",
    trend: "Trend",
    attentionLabel: "Padec",
    hideDetails: "Skrij podrobnosti",
    notesAndTags: "Opombe in oznake",
    sellerAlertToggle: "Obvesti me o spremembah pri prodajalcu za ta oglas",
    sellerAlertShort: "Opozorilo prodajalca",
    guideTitle: "Kako deluje",
    guideStep1: "Odprite oglas na Bolhi.",
    guideStep2: "Kliknite Spremljaj ta oglas.",
    guideStep3: "Kasneje se vrnite ali počakajte na samodejni pregled.",
    guideStep4: "Ko zaznamo novo nižjo ceno, dobite obvestilo v Chromu.",
    onboardingTitle: "Dobrodošli v sledilniku cen",
    onboardingCopy: "Ta razširitev lokalno spremlja oglase na Bolhi, pozneje ponovno preveri cene in vas obvesti, ko zazna padec cene.",
    onboardingDismiss: "Razumem",
    onboardingOpenSettings: "Odpri nastavitve",
    donateMissing: "Povezava za podporo še ni nastavljena.",
    roadmapTitle: "Načrt za V3",
    roadmapFunctionality: "Funkcionalnost",
    roadmapFunctionalityCopy: "Sinhronizacija v oblaku, izbirna prijava, e-poštna opozorila, deljeni seznami spremljanja, bogatejša cenovna analitika, filtri po kategorijah in opozorila na ravni prodajalca.",
    roadmapDesign: "Oblikovanje",
    roadmapDesignCopy: "Čistejša tipografija, boljši razmiki, hitrejša preglednost, izrazitejša prazna in uspešna stanja ter kompakten način za zahtevnejše uporabnike.",
    roadmapEase: "Enostavnost uporabe",
    roadmapEaseCopy: "Pametnejše uvajanje, paketne akcije, preprostejši uvoz in izvoz, jasnejši nadzor obvestil in razumljivejše razlage statusov.",
    optionsTitle: "Nastavitve sledilnika",
    optionsSubtitle: "Prilagodite samodejna osveževanja, obvestila in vzdrževalna orodja za svoj lokalni seznam spremljanja.",
    settingsSection: "Nastavitve",
    refreshFrequency: "Pogostost osveževanja",
    refreshHelp: "Načrtovana osveževanja v ozadju uporabljajo `chrome.alarms`.",
    scheduledRefresh: "Omogoči načrtovano osveževanje v ozadju",
    notificationsEnabled: "Obvesti me o na novo zaznanih padcih cen",
    badgeCount: "Na ikoni prikaži število neogledanih padcev",
    language: "Jezik",
    saveSettings: "Shrani nastavitve",
    settingsSavedState: "Shranjeno",
    saveViewPreset: "Shrani pogled",
    exportTitle: "Izvoz",
    exportDesc: "Prenesite spremljane oglase, opombe, oznake in nastavitve kot varnostno kopijo JSON.",
    exportButton: "Izvozi podatke",
    importTitle: "Uvoz",
    importDesc: "Uvozite varnostno kopijo in jo združite s trenutnimi podatki ali pa vse zamenjajte.",
    importMode: "Način uvoza",
    importMerge: "Združi s trenutnimi podatki",
    importReplace: "Zamenjaj trenutne podatke",
    chooseFile: "Izberite datoteko JSON",
    importButton: "Uvozi podatke",
    diagnosticsTitle: "Diagnostika selektorjev",
    diagnosticsDesc: "Preglejte uporabljene selektorje Bolhe in rezultate zajema z aktivnega zavihka.",
    runDiagnostics: "Zaženi diagnostiko na aktivnem zavihku",
    selectorConfig: "Konfiguracija selektorjev",
    diagnosticResult: "Rezultat aktivnega zavihka",
    diagnosticsHints: "Namigi za izluščenje",
    diagnosticsMissing: "Manjkajoča polja",
    diagnosticsOk: "Podatki oglasa so bili uspešno zaznani.",
    diagnosticsNotBolha: "Za diagnostiko odprite oglas na Bolhi v aktivnem zavihku.",
    diagnosticsNoTab: "Aktivni zavihek ni na voljo.",
    localeAuto: "Slovenščina",
    localeEn: "Slovenščina",
    localeSl: "Slovenščina",
    sortrecent: "Najnovejši najprej",
    sortlastChecked: "Nazadnje preverjeno",
    sortbiggestDrop: "Največji padec",
    sortpriceLow: "Najnižja cena",
    sorttitle: "Naslov A-Ž",
    sortoldest: "Najstarejši najprej",
    filterall: "Vsi",
    filterdrops: "Padci",
    filterdue: "Na vrsti",
    filterunavailable: "Nedosegljivi",
    filternotes: "Opombe",
    interval30: "Na 30 minut",
    interval60: "Vsako uro",
    interval180: "Na 3 ure",
    interval360: "Na 6 ur",
    interval720: "Na 12 ur",
    interval1440: "Vsak dan",
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
    shortIncreased: "Rast",
    shortUnavailable: "Nedosegljivo",
    droppedFromTo: "Padlo z $1 na $2",
    increasedFromTo: "Zraslo z $1 na $2",
    unavailableSummary: "Ta oglas na Bolhi ni na voljo. Preverjanje za morebitno vrnitev je še vedno načrtovano.",
    currentPriceSummary: "Trenutna cena: $1",
    deltaVsLast: "$1 glede na zadnji pregled",
    retrySummary: "Ponovni pregled je načrtovan $1",
    retryError: "Osvežitev ni uspela. Ponovni poskus je načrtovan $1",
    toastAdded: "Oglas je dodan v sledilnik.",
    toastDuplicate: "Ta oglas je že v spremljanju.",
    toastRefreshFailed: "Osvežitev ni uspela. Zadnji shranjeni podatki so še vedno na voljo.",
    toastRefreshSuccess: "Oglas je osvežen.",
    toastPriceDrop: "Zaznan je padec cene.",
    toastRemoved: "Oglas je odstranjen.",
    toastDetailsSaved: "Podrobnosti oglasa so shranjene.",
    toastSettingsSaved: "Nastavitve so shranjene.",
    toastDueRefreshed: "Osveženih oglasov, ki so bili na vrsti: $1.",
    toastNothingDue: "Noben oglas trenutno ne potrebuje osvežitve.",
    toastOnboardingReset: "Uvajanje je bilo ponastavljeno.",
    toastCloudBackupSaved: "Varnostna kopija v oblaku je shranjena v Chrome Sync.",
    toastCloudBackupRestored: "Varnostna kopija iz Chrome Sync je obnovljena.",
    toastPresetSaved: "Shranjeni pogled je dodan.",
    toastPresetRemoved: "Shranjeni pogled je odstranjen.",
    toastImportFailed: "Uvoz ni uspel. Preverite datoteko in poskusite znova.",
    toastImportDone: "Uvoženih oglasov: $1.",
    openBolhaButton: "Odpri Bolho",
    refreshDueButton: "Osveži oglase na vrsti ($1)",
    overviewTitle: "Pregled seznama spremljanja",
    overviewSubtitle: "Spremljajte stanje seznama, oglase na vrsti in naslednji pomemben trenutek.",
    actionsTitle: "Hitra dejanja",
    actionsSubtitle: "Zaženite vzdrževalna opravila, ne da bi zapustili stran z nastavitvami.",
    refreshDueAction: "Osveži oglase na vrsti",
    resetOnboarding: "Ponovno pokaži uvajanje",
    cloudTitle: "Varnostna kopija v oblaku",
    cloudSubtitle: "Ustvarite izbirno kopijo v Chrome Sync, da lahko svoj seznam spremljanja kasneje obnovite v istem prijavljenem profilu brskalnika.",
    cloudBackupButton: "Shrani v Chrome Sync",
    cloudRestoreButton: "Obnovi iz Chrome Sync",
    cloudStatusReady: "Kopija je pripravljena",
    cloudStatusItems: "Shranjeni oglasi: $1.",
    cloudStatusDate: "Zadnja kopija: $1",
    cloudStatusEmpty: "Kopije še ni",
    cloudStatusEmptyCopy: "Na tej strani ustvarite svojo prvo izbirno varnostno kopijo v oblaku.",
    presetsTitle: "Shranjeni pogledi",
    presetsSubtitle: "Pripravite si priljubljene poglede seznama spremljanja za hiter dostop v pojavnem oknu.",
    analyticsTitle: "Analitika cen",
    analyticsSubtitle: "Preglejte večji graf cen in hitre metrike za vsak spremljani oglas.",
    analyticsSelectLabel: "Spremljani oglas",
    analyticsChartTitle: "Zgodovina cen",
    analyticsMetricsTitle: "Metrike",
    analyticsSamples: "Vzorcev",
    analyticsLow: "Najnižja cena",
    analyticsHigh: "Najvišja cena",
    analyticsAverage: "Povprečje",
    analyticsChange: "Skupna sprememba",
    analyticsEmpty: "Pred prikazom analitike je potrebne več zgodovine osveževanj.",
    shortcutsTitle: "Bližnjice na tipkovnici",
    shortcutOpenPopup: "Odpri pojavno okno: Ctrl/Cmd + Shift + B",
    shortcutRefreshDue: "Osveži oglase na vrsti: Ctrl/Cmd + Shift + Y",
    panelExpand: "Razširi ploščo",
    panelMinimize: "Strni ploščo",
    closeLabel: "Zapri",
    presetEmpty: "Shranjeni pogledi še ne obstajajo.",
    presetPrompt: "Poimenujte ta shranjeni pogled seznama spremljanja",
    notificationTitleDrop: "Cena na Bolhi je padla!",
    notificationTitleSeller: "Opozorilo o prodajalcu na Bolhi",
    notificationBodyDrop: "$1: $2 -> $3",
    notificationSellerDrop: "$1 je spremenil ceno oglasa $2 na $3.",
    notificationSellerUnavailable: "Oglas $2 pri prodajalcu $1 ni več na voljo.",
    notificationSellerChanged: "Oglas $2 je zdaj povezan s prodajalcem $1.",
    exportFilename: "bolha-sledilnik-cen-izvoz",
    diagTitleField: "Naslov",
    diagPriceField: "Cena",
    diagSellerField: "Prodajalec",
    diagCategoryField: "Kategorija",
    diagStatusField: "Stanje"
  };

  const MESSAGES = {
    sl: BASE_MESSAGES,
    en: BASE_MESSAGES
  };

  function resolveLocale() {
    return "sl";
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
    const bundle = MESSAGES[locale] || MESSAGES.sl;
    return interpolate(bundle[key] || MESSAGES.sl[key] || key, substitutions);
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
      return getMessage("currentPriceSummary", preferredLocale, [formatCurrency(item.currentPrice, item.currency)]);
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
    return getMessage("deltaVsLast", preferredLocale, [`${prefix}${formatCurrency(Math.abs(delta), item.currency)}`]);
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
