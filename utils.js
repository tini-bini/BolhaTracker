(function initBolhaTrackerUtils(global) {
  const STORAGE_KEY = "trackedListings";
  const SETTINGS_KEY = "trackerSettings";
  const EXPORT_VERSION = 2;
  const HISTORY_LIMIT = 24;
  const MAX_TAGS = 8;
  const MAX_SAVED_VIEWS = 6;
  const ALARM_NAME = "scheduled-refresh";
  const DONATION_URLS = ["https://paypal.me/TiniFlegar"];

  const STATUS = {
    UNCHANGED: "unchanged",
    DROPPED: "dropped",
    INCREASED: "increased",
    UNAVAILABLE: "unavailable"
  };

  const MESSAGE_TYPES = {
    GET_PAGE_LISTING: "GET_PAGE_LISTING",
    ADD_TRACKED_LISTING: "ADD_TRACKED_LISTING",
    REFRESH_TRACKED_LISTING: "REFRESH_TRACKED_LISTING",
    REMOVE_TRACKED_LISTING: "REMOVE_TRACKED_LISTING",
    UPDATE_TRACKED_LISTING_META: "UPDATE_TRACKED_LISTING_META",
    GET_SETTINGS: "GET_SETTINGS",
    UPDATE_SETTINGS: "UPDATE_SETTINGS",
    MARK_DROPS_SEEN: "MARK_DROPS_SEEN",
    EXPORT_TRACKED_DATA: "EXPORT_TRACKED_DATA",
    IMPORT_TRACKED_DATA: "IMPORT_TRACKED_DATA",
    REFRESH_DUE_LISTINGS: "REFRESH_DUE_LISTINGS",
    CREATE_SYNC_BACKUP: "CREATE_SYNC_BACKUP",
    RESTORE_SYNC_BACKUP: "RESTORE_SYNC_BACKUP",
    GET_SYNC_BACKUP_STATUS: "GET_SYNC_BACKUP_STATUS"
  };

  const DEFAULT_SETTINGS = {
    scheduledRefreshEnabled: true,
    refreshIntervalMinutes: 180,
    notificationsEnabled: true,
    badgeCountEnabled: true,
    locale: "sl",
    onboardingCompleted: false,
    savedViews: []
  };
  const REFRESH_INTERVALS = [30, 60, 180, 360, 720, 1440];

  const STATUS_META = {
    [STATUS.UNCHANGED]: { tone: "unchanged" },
    [STATUS.DROPPED]: { tone: "dropped" },
    [STATUS.INCREASED]: { tone: "increased" },
    [STATUS.UNAVAILABLE]: { tone: "unavailable" }
  };

  const BOLHA_PAGE_CONFIG = {
    listingUrlPattern: /-oglas-\d+/i,
    bootPayloads: {
      summary: "ClassifiedDetailSummary",
      owner: "ContactSellerModal",
      tracking: "GTMTracking"
    },
    selectors: {
      title: [
        ".ClassifiedDetailSummary-title",
        "h1[itemprop='name']",
        "main h1",
        "h1"
      ],
      price: [
        ".ClassifiedDetailSummary-priceDomestic",
        ".ClassifiedDetailSummary-priceValue",
        "[data-testid='price']"
      ],
      seller: [
        ".ClassifiedDetailOwnerDetails-title a",
        ".ClassifiedDetailOwnerDetails-title",
        "[data-testid='seller-name']"
      ],
      sellerProfile: [
        ".ClassifiedDetailOwnerDetails-title a",
        "[data-testid='seller-name']"
      ],
      categoryLinks: [
        ".Breadcrumbs a",
        ".ClassifiedDetailBreadcrumbs a",
        "nav[aria-label='breadcrumb'] a"
      ],
      image: [
        ".ClassifiedDetailGallery img",
        ".ClassifiedDetailGallery picture img",
        "main img"
      ],
      metaImage: "meta[property='og:image']",
      unavailableNotice: [
        ".ClassifiedDetailUnavailableNotice",
        "[class*='UnavailableNotice']"
      ]
    },
    signals: {
      unavailableTitle: "Oglas ne obstaja",
      unavailablePhrases: [
        "Ta oglas je potekel",
        "Oglas je prodan ali izbrisan"
      ],
      negotiablePhrases: [
        "cena po dogovoru",
        "po dogovoru",
        "na vprašanje",
        "na vprasanje"
      ]
    },
    extractionHints: [
      "JSON-LD Product block",
      "ClassifiedDetailSummary boot payload",
      "Meta oznake Open Graph",
      "Selektorji DOM za Bolho"
    ]
  };

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.hash = "";
      url.search = "";

      if (url.pathname.length > 1) {
        url.pathname = url.pathname.replace(/\/+$/, "");
      }

      return url.toString();
    } catch (error) {
      return rawUrl || "";
    }
  }

  function isBolhaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return /(^|\.)bolha\.com$/i.test(url.hostname);
    } catch (error) {
      return false;
    }
  }

  function isLikelyListingUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return isBolhaUrl(rawUrl) && BOLHA_PAGE_CONFIG.listingUrlPattern.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function toAbsoluteUrl(value, baseUrl) {
    if (!value) {
      return null;
    }

    const cleaned = cleanText(value);

    if (!cleaned) {
      return null;
    }

    if (cleaned.startsWith("//")) {
      return `https:${cleaned}`;
    }

    try {
      return new URL(cleaned, baseUrl || "https://www.bolha.com").toString();
    } catch (error) {
      return cleaned;
    }
  }

  function extractDigits(text) {
    return cleanText(text).replace(/[^\d,.\-]/g, "");
  }

  function parsePriceText(rawText, fallbackCurrency) {
    const priceText = cleanText(rawText);
    const currency = /\u20ac|eur|evro/i.test(priceText) || fallbackCurrency === "EUR" ? "EUR" : fallbackCurrency || "EUR";

    if (!priceText) {
      return { amount: null, currency, priceText: "" };
    }

    if (BOLHA_PAGE_CONFIG.signals.negotiablePhrases.some((phrase) => priceText.toLowerCase().includes(phrase))) {
      return { amount: null, currency, priceText };
    }

    const numericCandidate = extractDigits(priceText);

    if (!numericCandidate || !/\d/.test(numericCandidate)) {
      return { amount: null, currency, priceText };
    }

    const normalized = numericCandidate
      .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
      .replace(/\s/g, "")
      .replace(",", ".");
    const amount = Number.parseFloat(normalized);

    return {
      amount: Number.isFinite(amount) ? amount : null,
      currency,
      priceText
    };
  }

  function formatCurrency(amount, currency) {
    if (amount == null || Number.isNaN(amount)) {
      return "Cena ni na voljo";
    }

    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: currency || "EUR",
        maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
      }).format(amount);
    } catch (error) {
      return `${amount} ${currency || "EUR"}`;
    }
  }

  function isValidPayPalMeLink(rawUrl) {
    if (!rawUrl) {
      return false;
    }

    try {
      const url = new URL(String(rawUrl).trim());
      const hostname = url.hostname.toLowerCase();

      if (url.protocol !== "https:") {
        return false;
      }

      if (!["paypal.me", "www.paypal.me"].includes(hostname)) {
        return false;
      }

      const segments = url.pathname.split("/").filter(Boolean);

      if (segments.length < 1 || segments.length > 2) {
        return false;
      }

      if (!/^[a-z0-9._-]{2,20}$/i.test(segments[0])) {
        return false;
      }

      if (segments[1] && !/^\d+(?:[.,]\d{1,2})?(?:[A-Z]{3})?$/i.test(segments[1])) {
        return false;
      }

      return !url.search && !url.hash;
    } catch (error) {
      return false;
    }
  }

  function buildPayPalMeLink(baseUrl, amount, currencyCode) {
    if (!isValidPayPalMeLink(baseUrl)) {
      return null;
    }

    if (amount == null || amount === "") {
      return normalizeUrl(baseUrl);
    }

    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return null;
    }

    const parsed = new URL(baseUrl);
    const amountPart = normalizedAmount % 1 === 0 ? String(normalizedAmount) : normalizedAmount.toFixed(2);
    const currencyPart = currencyCode && /^[A-Z]{3}$/i.test(currencyCode) ? currencyCode.toUpperCase() : "";
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/${amountPart}${currencyPart}`;
    return parsed.toString();
  }

  function getPreferredDonationLink() {
    return DONATION_URLS.find(isValidPayPalMeLink) || null;
  }

  function formatDateTime(timestamp, locale) {
    if (!timestamp) {
      return "Nikoli";
    }

    try {
      return new Intl.DateTimeFormat(locale || "sl-SI", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  function hashString(input) {
    let hash = 0;

    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  function getListingId(url) {
    const normalizedUrl = normalizeUrl(url);
    const adIdMatch = normalizedUrl.match(/-oglas-(\d+)/i);
    return adIdMatch ? `bolha_${adIdMatch[1]}` : `bolha_${hashString(normalizedUrl)}`;
  }

  function getMetaContent(documentRef, selector) {
    const node = documentRef.querySelector(selector);
    return node ? cleanText(node.getAttribute("content")) : "";
  }

  function getFirstText(documentRef, selectors) {
    for (const selector of selectors) {
      const node = documentRef.querySelector(selector);
      const value = cleanText(node ? node.textContent : "");

      if (value) {
        return value;
      }
    }

    return "";
  }

  function getFirstAttribute(documentRef, selectors, attributeName) {
    for (const selector of selectors) {
      const node = documentRef.querySelector(selector);
      const value = cleanText(node ? node.getAttribute(attributeName) : "");

      if (value) {
        return value;
      }
    }

    return "";
  }

  function getCategoryFromDocument(documentRef) {
    for (const selector of BOLHA_PAGE_CONFIG.selectors.categoryLinks) {
      const values = Array.from(documentRef.querySelectorAll(selector))
        .map((node) => cleanText(node.textContent))
        .filter(Boolean)
        .filter((label) => !/^domov$/i.test(label));

      if (values.length) {
        return {
          categoryLabel: values[values.length - 1],
          categoryPath: values
        };
      }
    }

    return {
      categoryLabel: null,
      categoryPath: []
    };
  }

  function extractJsonObjectAfterMarker(source, marker) {
    const markerIndex = source.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const startIndex = source.indexOf("{", markerIndex + marker.length - 1);

    if (startIndex === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
      const character = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === "\"") {
          inString = false;
        }

        continue;
      }

      if (character === "\"") {
        inString = true;
        continue;
      }

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          return safeJsonParse(source.slice(startIndex, index + 1));
        }
      }
    }

    return null;
  }

  function extractBootValues(source, name) {
    return extractJsonObjectAfterMarker(source, `app.boot.push({"name":"${name}","values":`);
  }

  function extractMetaTagValue(source, attributeName, attributeValue) {
    const regex = new RegExp(
      `<meta[^>]+${attributeName}=["']${attributeValue}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const match = source.match(regex);
    return match ? cleanText(match[1]) : "";
  }

  function extractTitleTagValue(source) {
    const match = source.match(/<title>([^<]+)<\/title>/i);
    return match ? cleanText(match[1]) : "";
  }

  function extractPriceTextFromHtml(source) {
    const match = source.match(
      /<dd class="ClassifiedDetailSummary-priceDomestic"[^>]*>\s*([^<]+?)\s*<\/dd>/i
    );
    return match ? cleanText(match[1]) : "";
  }

  function extractSellerNameFromHtml(source) {
    const owner = extractBootValues(source, BOLHA_PAGE_CONFIG.bootPayloads.owner);

    if (owner && owner.ownerUsername) {
      return cleanText(owner.ownerUsername);
    }

    const match = source.match(
      /<h2 class="ClassifiedDetailOwnerDetails-title">.*?<a[^>]*>([^<]+)<\/a>\s*<\/h2>/is
    );

    return match ? cleanText(match[1]) : "";
  }

  function extractSellerProfileUrlFromHtml(source, pageUrl) {
    const match = source.match(
      /<h2 class="ClassifiedDetailOwnerDetails-title">.*?<a[^>]+href=["']([^"']+)["'][^>]*>/is
    );

    return match ? toAbsoluteUrl(match[1], pageUrl) : null;
  }

  function findProductNode(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    if (data["@type"] === "Product") {
      return data;
    }

    if (Array.isArray(data["@graph"])) {
      return data["@graph"].find((entry) => entry && entry["@type"] === "Product") || null;
    }

    if (Array.isArray(data)) {
      return data.map(findProductNode).find(Boolean) || null;
    }

    return null;
  }

  function extractJsonLdProductFromHtml(source) {
    const matches = source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];

    for (const scriptTag of matches) {
      const scriptMatch = scriptTag.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
      const parsed = safeJsonParse(scriptMatch ? scriptMatch[1].trim() : "");
      const productNode = findProductNode(parsed);

      if (productNode) {
        return productNode;
      }
    }

    return null;
  }

  function extractCategoryFromHtml(source) {
    const product = extractJsonLdProductFromHtml(source);
    const categoryText = cleanText(product && product.category ? product.category : "");

    if (!categoryText) {
      return {
        categoryLabel: null,
        categoryPath: []
      };
    }

    const pieces = categoryText.split(">").map((entry) => cleanText(entry)).filter(Boolean);

    return {
      categoryLabel: pieces[pieces.length - 1] || categoryText,
      categoryPath: pieces.length ? pieces : [categoryText]
    };
  }

  function hasUnavailableSignals(text) {
    const clean = cleanText(text).toLowerCase();
    return BOLHA_PAGE_CONFIG.signals.unavailablePhrases.some((phrase) => clean.includes(phrase.toLowerCase()));
  }

  function hasUnavailableSelectors(documentRef) {
    return BOLHA_PAGE_CONFIG.selectors.unavailableNotice.some((selector) => documentRef.querySelector(selector));
  }

  function getImageFromDocument(documentRef) {
    return (
      getMetaContent(documentRef, BOLHA_PAGE_CONFIG.selectors.metaImage) ||
      getFirstAttribute(documentRef, BOLHA_PAGE_CONFIG.selectors.image, "src")
    );
  }

  function getVisibleDocumentText(documentRef) {
    const clone = documentRef.body ? documentRef.body.cloneNode(true) : null;

    if (!clone) {
      return "";
    }

    clone.querySelectorAll("script, style, noscript, template").forEach((node) => node.remove());
    return cleanText(clone.textContent || "");
  }

  function sanitizeSettings(rawSettings) {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(rawSettings || {})
    };
    const interval = Number(merged.refreshIntervalMinutes);

    return {
      scheduledRefreshEnabled: Boolean(merged.scheduledRefreshEnabled),
      refreshIntervalMinutes: REFRESH_INTERVALS.includes(interval) ? interval : DEFAULT_SETTINGS.refreshIntervalMinutes,
      notificationsEnabled: merged.notificationsEnabled !== false,
      badgeCountEnabled: merged.badgeCountEnabled !== false,
      locale: "sl",
      onboardingCompleted: Boolean(merged.onboardingCompleted),
      savedViews: normalizeSavedViews(merged.savedViews)
    };
  }

  async function getSettings() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return sanitizeSettings(stored[SETTINGS_KEY]);
  }

  async function saveSettings(nextSettings) {
    const normalized = sanitizeSettings(nextSettings);
    await chrome.storage.local.set({
      [SETTINGS_KEY]: normalized
    });
    return normalized;
  }

  function normalizeTags(rawTags) {
    const values = Array.isArray(rawTags)
      ? rawTags
      : String(rawTags || "")
          .split(",")
          .map((entry) => entry.trim());

    return values
      .map(cleanText)
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, MAX_TAGS);
  }

  function normalizeSavedViews(rawViews) {
    const validFilters = ["all", "drops", "due", "unavailable", "notes"];
    const validSorts = ["recent", "lastChecked", "biggestDrop", "priceLow", "title", "oldest"];

    return (Array.isArray(rawViews) ? rawViews : [])
      .map((view) => {
        const name = cleanText(view && view.name).slice(0, 32);
        const query = cleanText(view && view.query).slice(0, 80);
        const filter = validFilters.includes(view && view.filter) ? view.filter : "all";
        const sort = validSorts.includes(view && view.sort) ? view.sort : "recent";

        if (!name) {
          return null;
        }

        return {
          id: cleanText(view && view.id) || `view_${hashString(`${name}:${query}:${filter}:${sort}`)}`,
          name,
          query,
          filter,
          sort
        };
      })
      .filter(Boolean)
      .filter((view, index, array) => array.findIndex((entry) => entry.id === view.id) === index)
      .slice(0, MAX_SAVED_VIEWS);
  }

  function normalizeExtractedListing(rawListing) {
    const normalizedUrl = normalizeUrl(rawListing.url);
    const currency = rawListing.currency || "EUR";
    const parsedPrice = parsePriceText(rawListing.priceText || "", currency);
    const price = rawListing.price != null ? rawListing.price : parsedPrice.amount;
    const priceText =
      cleanText(rawListing.priceText) ||
      (price != null ? formatCurrency(price, currency) : rawListing.available === false ? "Oglas ni na voljo" : "Cena ni zaznana");

    return {
      id: getListingId(normalizedUrl),
      url: normalizedUrl,
      title: cleanText(rawListing.title) || "Bolha oglas",
      price,
      priceText,
      currency,
      imageUrl: toAbsoluteUrl(rawListing.imageUrl, normalizedUrl),
      sellerName: cleanText(rawListing.sellerName) || null,
      sellerProfileUrl: toAbsoluteUrl(rawListing.sellerProfileUrl, normalizedUrl),
      categoryLabel: cleanText(rawListing.categoryLabel) || null,
      categoryPath: Array.isArray(rawListing.categoryPath) ? rawListing.categoryPath.map(cleanText).filter(Boolean) : [],
      available: rawListing.available !== false,
      isDetected: Boolean(rawListing.isDetected),
      extractionHints: rawListing.extractionHints || BOLHA_PAGE_CONFIG.extractionHints
    };
  }

  function extractListingFromHtml(source, pageUrl) {
    const normalizedUrl = normalizeUrl(pageUrl);
    const product = extractJsonLdProductFromHtml(source);
    const summary = extractBootValues(source, BOLHA_PAGE_CONFIG.bootPayloads.summary);
    const tracking = extractBootValues(source, BOLHA_PAGE_CONFIG.bootPayloads.tracking);
    const bannerData = extractJsonObjectAfterMarker(source, "var ad_banner_data = ");
    const titleTag = extractTitleTagValue(source);
    const category = extractCategoryFromHtml(source);
    const missingNotice =
      titleTag === BOLHA_PAGE_CONFIG.signals.unavailableTitle ||
      /ClassifiedDetailUnavailableNotice/i.test(source);

    const productOffer = product && product.offers ? product.offers : null;
    const productAvailability = String(productOffer && productOffer.availability ? productOffer.availability : "");
    const isUnavailable =
      missingNotice ||
      productAvailability.includes("OutOfStock") ||
      Boolean(summary && summary.isUnavailable) ||
      /expired|inactive/i.test(String(tracking && tracking.adStatus ? tracking.adStatus : ""));

    const rawPriceText =
      extractPriceTextFromHtml(source) ||
      (productOffer && productOffer.price != null
        ? `${productOffer.price} ${(productOffer.priceCurrency || "EUR").replace("EUR", "EUR")}`
        : "");
    const parsedPrice = parsePriceText(rawPriceText, productOffer && productOffer.priceCurrency);

    const listing = normalizeExtractedListing({
      url: normalizedUrl,
      title:
        (product && product.name) ||
        (summary && summary.adTitle) ||
        extractMetaTagValue(source, "property", "og:title") ||
        titleTag,
      price:
        parsedPrice.amount != null
          ? parsedPrice.amount
          : productOffer && productOffer.price != null
            ? Number(productOffer.price)
            : summary && summary.adDomesticPrice != null
              ? Number(summary.adDomesticPrice)
              : bannerData && bannerData.price_euro != null
                ? Number(bannerData.price_euro)
                : null,
      priceText: rawPriceText,
      currency: (productOffer && productOffer.priceCurrency) || parsedPrice.currency || "EUR",
      imageUrl:
        (Array.isArray(product && product.image) ? product.image[0] : product && product.image) ||
        (summary && summary.adHeadImageUrl) ||
        (bannerData && bannerData.ad_image_url) ||
        extractMetaTagValue(source, "property", "og:image"),
      sellerName: extractSellerNameFromHtml(source),
      sellerProfileUrl: extractSellerProfileUrlFromHtml(source, normalizedUrl),
      categoryLabel: category.categoryLabel,
      categoryPath: category.categoryPath,
      available: !isUnavailable,
      isDetected:
        isLikelyListingUrl(normalizedUrl) &&
        (missingNotice ||
          Boolean(
            (product && product.name) ||
            (summary && summary.adTitle) ||
            extractMetaTagValue(source, "property", "og:title")
          )),
      extractionHints: BOLHA_PAGE_CONFIG.extractionHints
    });

    if (!listing.available) {
      listing.price = null;
      listing.priceText = "Oglas ni na voljo";
    }

    return listing;
  }

  function extractListingFromDocument(documentRef, pageUrl) {
    const normalizedUrl = normalizeUrl(pageUrl || (global.location && global.location.href));
    const htmlFallback = extractListingFromHtml(documentRef.documentElement.outerHTML, normalizedUrl);
    const category = getCategoryFromDocument(documentRef);
    const title = getFirstText(documentRef, BOLHA_PAGE_CONFIG.selectors.title);
    const priceText = getFirstText(documentRef, BOLHA_PAGE_CONFIG.selectors.price);
    const sellerName = getFirstText(documentRef, BOLHA_PAGE_CONFIG.selectors.seller);
    const sellerProfileUrl = getFirstAttribute(documentRef, BOLHA_PAGE_CONFIG.selectors.sellerProfile, "href");
    const imageUrl = getImageFromDocument(documentRef);
    const parsedPrice = parsePriceText(priceText, htmlFallback.currency);
    const pageText = getVisibleDocumentText(documentRef);
    const isUnavailable =
      htmlFallback.available === false ||
      hasUnavailableSignals(pageText) ||
      hasUnavailableSelectors(documentRef) ||
      cleanText(documentRef.title) === BOLHA_PAGE_CONFIG.signals.unavailableTitle;

    const listing = normalizeExtractedListing({
      url: normalizedUrl,
      title: title || htmlFallback.title,
      price: parsedPrice.amount != null ? parsedPrice.amount : htmlFallback.price,
      priceText: priceText || htmlFallback.priceText,
      currency: parsedPrice.currency || htmlFallback.currency || "EUR",
      imageUrl: imageUrl || htmlFallback.imageUrl,
      sellerName: sellerName || htmlFallback.sellerName,
      sellerProfileUrl: sellerProfileUrl || htmlFallback.sellerProfileUrl,
      categoryLabel: category.categoryLabel || htmlFallback.categoryLabel,
      categoryPath: category.categoryPath.length ? category.categoryPath : htmlFallback.categoryPath,
      available: !isUnavailable,
      isDetected: htmlFallback.isDetected || (isLikelyListingUrl(normalizedUrl) && Boolean(title || priceText || isUnavailable)),
      extractionHints: BOLHA_PAGE_CONFIG.extractionHints
    });

    if (!listing.available) {
      listing.price = null;
      listing.priceText = "Oglas ni na voljo";
    }

    return {
      ...listing,
      isBolhaPage: isBolhaUrl(normalizedUrl),
      isListing: listing.isDetected
    };
  }

  function createHistoryEntry(item) {
    return {
      timestamp: item.lastChecked || Date.now(),
      price: item.currentPrice != null ? Number(item.currentPrice) : null,
      available: item.available !== false,
      status: item.status || STATUS.UNCHANGED
    };
  }

  function normalizePriceHistory(rawHistory) {
    const values = Array.isArray(rawHistory) ? rawHistory : [];

    return values
      .map((entry) => ({
        timestamp: Number(entry && entry.timestamp ? entry.timestamp : Date.now()),
        price: entry && entry.price != null && Number.isFinite(Number(entry.price)) ? Number(entry.price) : null,
        available: entry && entry.available !== false,
        status: entry && entry.status ? entry.status : STATUS.UNCHANGED
      }))
      .slice(-HISTORY_LIMIT);
  }

  function appendPriceHistory(existingHistory, item) {
    const history = normalizePriceHistory(existingHistory);
    const nextEntry = createHistoryEntry(item);
    const lastEntry = history[history.length - 1];

    if (
      lastEntry &&
      lastEntry.price === nextEntry.price &&
      lastEntry.available === nextEntry.available &&
      lastEntry.status === nextEntry.status
    ) {
      lastEntry.timestamp = nextEntry.timestamp;
      return history.slice(-HISTORY_LIMIT);
    }

    history.push(nextEntry);
    return history.slice(-HISTORY_LIMIT);
  }

  function normalizeStoredListing(rawItem) {
    const url = normalizeUrl(rawItem && rawItem.url);
    const id = rawItem && rawItem.id ? rawItem.id : getListingId(url);
    const available = rawItem && rawItem.available !== false;
    const currentPrice =
      rawItem && rawItem.currentPrice != null && Number.isFinite(Number(rawItem.currentPrice))
        ? Number(rawItem.currentPrice)
        : null;
    const lastAvailablePrice =
      rawItem && rawItem.lastAvailablePrice != null && Number.isFinite(Number(rawItem.lastAvailablePrice))
        ? Number(rawItem.lastAvailablePrice)
        : available
          ? currentPrice
          : null;

    return {
      id,
      url,
      title: cleanText(rawItem && rawItem.title) || "Bolha oglas",
      price: currentPrice,
      priceText: cleanText(rawItem && rawItem.priceText) || (currentPrice != null ? formatCurrency(currentPrice, rawItem && rawItem.currency) : "Cena ni zaznana"),
      currency: cleanText(rawItem && rawItem.currency) || "EUR",
      imageUrl: rawItem && rawItem.imageUrl ? rawItem.imageUrl : null,
      sellerName: cleanText(rawItem && rawItem.sellerName) || null,
      sellerProfileUrl: rawItem && rawItem.sellerProfileUrl ? rawItem.sellerProfileUrl : null,
      categoryLabel: cleanText(rawItem && rawItem.categoryLabel) || null,
      categoryPath: Array.isArray(rawItem && rawItem.categoryPath) ? rawItem.categoryPath.map(cleanText).filter(Boolean) : [],
      dateTracked: Number(rawItem && rawItem.dateTracked) || Date.now(),
      lastChecked: Number(rawItem && rawItem.lastChecked) || Number(rawItem && rawItem.dateTracked) || 0,
      lastPrice:
        rawItem && rawItem.lastPrice != null && Number.isFinite(Number(rawItem.lastPrice)) ? Number(rawItem.lastPrice) : currentPrice,
      currentPrice,
      lastAvailablePrice,
      status: rawItem && rawItem.status ? rawItem.status : available ? STATUS.UNCHANGED : STATUS.UNAVAILABLE,
      available,
      lastError: cleanText(rawItem && rawItem.lastError) || null,
      lastNotifiedDropPrice:
        rawItem && rawItem.lastNotifiedDropPrice != null && Number.isFinite(Number(rawItem.lastNotifiedDropPrice))
          ? Number(rawItem.lastNotifiedDropPrice)
          : null,
      lastDetectedDropPrice:
        rawItem && rawItem.lastDetectedDropPrice != null && Number.isFinite(Number(rawItem.lastDetectedDropPrice))
          ? Number(rawItem.lastDetectedDropPrice)
          : null,
      hasUnseenDrop: Boolean(rawItem && rawItem.hasUnseenDrop),
      dropDetectedAt: Number(rawItem && rawItem.dropDetectedAt) || null,
      lastViewedDropAt: Number(rawItem && rawItem.lastViewedDropAt) || null,
      notes: cleanText(rawItem && rawItem.notes),
      tags: normalizeTags(rawItem && rawItem.tags),
      sellerAlertEnabled: Boolean(rawItem && rawItem.sellerAlertEnabled),
      nextCheckAt: Number(rawItem && rawItem.nextCheckAt) || null,
      priceHistory: normalizePriceHistory(rawItem && rawItem.priceHistory),
      consecutiveUnavailableCount: Number(rawItem && rawItem.consecutiveUnavailableCount) || 0,
      consecutiveErrorCount: Number(rawItem && rawItem.consecutiveErrorCount) || 0,
      lastSeenAvailableAt: Number(rawItem && rawItem.lastSeenAvailableAt) || (available ? Number(rawItem && rawItem.lastChecked) || null : null),
      lastUnavailableAt: Number(rawItem && rawItem.lastUnavailableAt) || (!available ? Number(rawItem && rawItem.lastChecked) || null : null)
    };
  }

  function createTrackedListing(listing, settings) {
    const now = Date.now();
    const normalizedSettings = sanitizeSettings(settings);
    const currentPrice = listing.available === false ? null : listing.price;
    const trackedItem = normalizeStoredListing({
      id: listing.id || getListingId(listing.url),
      url: normalizeUrl(listing.url),
      title: listing.title,
      price: currentPrice,
      priceText: listing.priceText,
      currency: listing.currency || "EUR",
      imageUrl: listing.imageUrl || null,
      sellerName: listing.sellerName || null,
      sellerProfileUrl: listing.sellerProfileUrl || null,
      categoryLabel: listing.categoryLabel || null,
      categoryPath: listing.categoryPath || [],
      dateTracked: now,
      lastChecked: now,
      lastPrice: currentPrice,
      currentPrice,
      lastAvailablePrice: currentPrice,
      status: listing.available === false ? STATUS.UNAVAILABLE : STATUS.UNCHANGED,
      available: listing.available !== false,
      lastError: null,
      lastNotifiedDropPrice: null,
      lastDetectedDropPrice: null,
      hasUnseenDrop: false,
      dropDetectedAt: null,
      lastViewedDropAt: null,
      notes: "",
      tags: [],
      sellerAlertEnabled: false,
      nextCheckAt: normalizedSettings.scheduledRefreshEnabled
        ? now + normalizedSettings.refreshIntervalMinutes * 60000
        : null,
      priceHistory: [],
      consecutiveUnavailableCount: listing.available === false ? 1 : 0,
      consecutiveErrorCount: 0,
      lastSeenAvailableAt: listing.available === false ? null : now,
      lastUnavailableAt: listing.available === false ? now : null
    });

    trackedItem.priceHistory = appendPriceHistory([], trackedItem);
    return trackedItem;
  }

  function mergeTrackedListing(previousItem, latestListing) {
    const previous = normalizeStoredListing(previousItem);
    const latest = normalizeExtractedListing(latestListing);
    const referencePrice = previous.available !== false && previous.currentPrice != null
      ? previous.currentPrice
      : previous.lastAvailablePrice;
    const nextPrice = latest.available === false ? null : latest.price;
    let nextStatus = previous.status;

    if (latest.available === false) {
      nextStatus = STATUS.UNAVAILABLE;
    } else if (referencePrice == null || nextPrice == null) {
      nextStatus = STATUS.UNCHANGED;
    } else if (nextPrice < referencePrice) {
      nextStatus = STATUS.DROPPED;
    } else if (nextPrice > referencePrice) {
      nextStatus = STATUS.INCREASED;
    } else {
      nextStatus = STATUS.UNCHANGED;
    }

    const merged = normalizeStoredListing({
      ...previous,
      title:
        latest.title && !/^(oglas ne obstaja|bolha oglas)$/i.test(latest.title)
          ? latest.title
          : previous.title,
      price: nextPrice,
      priceText: latest.priceText || previous.priceText,
      currency: latest.currency || previous.currency,
      imageUrl: latest.imageUrl || previous.imageUrl,
      sellerName: latest.sellerName || previous.sellerName,
      sellerProfileUrl: latest.sellerProfileUrl || previous.sellerProfileUrl,
      categoryLabel: latest.categoryLabel || previous.categoryLabel,
      categoryPath: latest.categoryPath && latest.categoryPath.length ? latest.categoryPath : previous.categoryPath,
      lastChecked: Date.now(),
      lastPrice: referencePrice,
      currentPrice: nextPrice,
      lastAvailablePrice: latest.available === false ? previous.lastAvailablePrice : nextPrice,
      status: nextStatus,
      available: latest.available !== false,
      lastError: null,
      consecutiveUnavailableCount: latest.available === false ? previous.consecutiveUnavailableCount + 1 : 0,
      consecutiveErrorCount: 0,
      lastSeenAvailableAt: latest.available === false ? previous.lastSeenAvailableAt : Date.now(),
      lastUnavailableAt: latest.available === false ? Date.now() : previous.lastUnavailableAt
    });

    merged.priceHistory = appendPriceHistory(previous.priceHistory, merged);
    return merged;
  }

  function getNextCheckAt(now, previousItem, resultType, settings) {
    const normalizedSettings = sanitizeSettings(settings);

    if (!normalizedSettings.scheduledRefreshEnabled) {
      return null;
    }

    const baseMs = normalizedSettings.refreshIntervalMinutes * 60000;
    const previous = previousItem ? normalizeStoredListing(previousItem) : null;

    if (resultType === "error") {
      const count = previous ? Math.max(1, previous.consecutiveErrorCount) : 1;
      return now + Math.min(baseMs, 15 * 60000 * Math.pow(2, Math.max(0, count - 1)));
    }

    if (resultType === "unavailable") {
      const count = previous ? Math.max(1, previous.consecutiveUnavailableCount) : 1;
      return now + Math.min(baseMs, 30 * 60000 * Math.pow(2, Math.max(0, count - 1)));
    }

    return now + baseMs;
  }

  function createRefreshFailureItem(currentItem, error, settings) {
    const previous = normalizeStoredListing(currentItem);
    const next = normalizeStoredListing({
      ...previous,
      lastChecked: Date.now(),
      lastError: error.message || "Tega oglasa trenutno ni mogoče osvežiti.",
      consecutiveErrorCount: previous.consecutiveErrorCount + 1
    });

    next.nextCheckAt = getNextCheckAt(Date.now(), next, "error", settings);
    return next;
  }

  function markDropDetected(previousItem, nextItem) {
    if (
      !previousItem ||
      !nextItem ||
      nextItem.status !== STATUS.DROPPED ||
      nextItem.currentPrice == null ||
      nextItem.lastPrice == null ||
      nextItem.currentPrice >= nextItem.lastPrice
    ) {
      return {
        ...nextItem,
        hasUnseenDrop: Boolean(nextItem.hasUnseenDrop),
        lastDetectedDropPrice: previousItem ? previousItem.lastDetectedDropPrice : nextItem.lastDetectedDropPrice,
        dropDetectedAt: previousItem ? previousItem.dropDetectedAt : nextItem.dropDetectedAt
      };
    }

    const isNewDrop =
      previousItem.lastDetectedDropPrice == null || nextItem.currentPrice < previousItem.lastDetectedDropPrice;

    return {
      ...nextItem,
      hasUnseenDrop: isNewDrop ? true : Boolean(previousItem.hasUnseenDrop),
      lastDetectedDropPrice: isNewDrop ? nextItem.currentPrice : previousItem.lastDetectedDropPrice,
      dropDetectedAt: isNewDrop ? Date.now() : previousItem.dropDetectedAt
    };
  }

  function applyScheduledMetadata(previousItem, nextItem, settings) {
    const previous = normalizeStoredListing(previousItem);
    let next = normalizeStoredListing(nextItem);

    if (next.available === false) {
      next.nextCheckAt = getNextCheckAt(Date.now(), next, "unavailable", settings);
      return next;
    }

    next.nextCheckAt = getNextCheckAt(Date.now(), next, "success", settings);
    next = markDropDetected(previous, next);
    return next;
  }

  function shouldNotifyPriceDrop(previousItem, nextItem, settings) {
    const normalizedSettings = sanitizeSettings(settings);

    return Boolean(
      normalizedSettings.notificationsEnabled &&
      previousItem &&
      nextItem &&
      nextItem.lastError == null &&
      nextItem.status === STATUS.DROPPED &&
      nextItem.lastPrice != null &&
      nextItem.currentPrice != null &&
      nextItem.currentPrice < nextItem.lastPrice &&
      (previousItem.lastNotifiedDropPrice == null || nextItem.currentPrice < previousItem.lastNotifiedDropPrice)
    );
  }

  function markDropNotificationSent(item) {
    return {
      ...item,
      lastNotifiedDropPrice: item.currentPrice
    };
  }

  function markDropsSeen(items) {
    const now = Date.now();

    return (Array.isArray(items) ? items : []).map((item) => {
      const normalized = normalizeStoredListing(item);

      if (!normalized.hasUnseenDrop) {
        return normalized;
      }

      return {
        ...normalized,
        hasUnseenDrop: false,
        lastViewedDropAt: now
      };
    });
  }

  function getUnseenDropCount(items) {
    return (Array.isArray(items) ? items : []).filter((item) => normalizeStoredListing(item).hasUnseenDrop).length;
  }

  function getPriceDelta(item) {
    if (!item || item.lastPrice == null || item.currentPrice == null) {
      return null;
    }

    return item.currentPrice - item.lastPrice;
  }

  function getPriceSeries(item) {
    return normalizePriceHistory(item && item.priceHistory)
      .filter((entry) => entry.available !== false && entry.price != null)
      .map((entry) => entry.price);
  }

  function getPriceAnalytics(item) {
    const history = normalizePriceHistory(item && item.priceHistory)
      .filter((entry) => entry.available !== false && entry.price != null);
    const prices = history.map((entry) => entry.price);

    if (!prices.length) {
      return {
        sampleCount: 0,
        low: null,
        high: null,
        average: null,
        firstPrice: null,
        lastPrice: null,
        delta: null,
        percentChange: null
      };
    }

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const delta = lastPrice - firstPrice;

    return {
      sampleCount: prices.length,
      low: Math.min(...prices),
      high: Math.max(...prices),
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      firstPrice,
      lastPrice,
      delta,
      percentChange: firstPrice ? (delta / firstPrice) * 100 : null
    };
  }

  function buildSparklinePath(points, width, height) {
    if (!Array.isArray(points) || points.length < 2) {
      return "";
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((point - min) / range) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }

  async function getTrackedListings() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const items = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    return items.map(normalizeStoredListing);
  }

  async function saveTrackedListings(items) {
    const normalized = (Array.isArray(items) ? items : []).map(normalizeStoredListing);
    await chrome.storage.local.set({
      [STORAGE_KEY]: normalized
    });
    return normalized;
  }

  async function findTrackedListingByUrl(url) {
    const normalizedUrl = normalizeUrl(url);
    const items = await getTrackedListings();
    return items.find((item) => normalizeUrl(item.url) === normalizedUrl) || null;
  }

  async function removeTrackedListing(id) {
    const items = await getTrackedListings();
    const nextItems = items.filter((item) => item.id !== id);
    await saveTrackedListings(nextItems);
    return nextItems;
  }

  function createExportPayload(items, settings) {
    return {
      app: "BOLHA Sledilnik cen",
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      settings: sanitizeSettings(settings),
      items: (Array.isArray(items) ? items : []).map(normalizeStoredListing)
    };
  }

  function normalizeImportPayload(payload) {
    if (Array.isArray(payload)) {
      return {
        items: payload.map(normalizeStoredListing),
        settings: null
      };
    }

    const safePayload = payload && typeof payload === "object" ? payload : {};

    return {
      items: Array.isArray(safePayload.items) ? safePayload.items.map(normalizeStoredListing) : [],
      settings: safePayload.settings ? sanitizeSettings(safePayload.settings) : null
    };
  }

  function mergeImportedData(currentItems, importedItems, mode) {
    const sourceItems = Array.isArray(currentItems) ? currentItems.map(normalizeStoredListing) : [];
    const incomingItems = Array.isArray(importedItems) ? importedItems.map(normalizeStoredListing) : [];

    if (mode === "replace") {
      return incomingItems.sort((first, second) => second.dateTracked - first.dateTracked);
    }

    const map = new Map(sourceItems.map((item) => [item.id, item]));
    incomingItems.forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values()).sort((first, second) => second.dateTracked - first.dateTracked);
  }

  function getTrackedListingStats(items, now = Date.now()) {
    const normalizedItems = Array.isArray(items) ? items.map(normalizeStoredListing) : [];
    const nextCheckValues = normalizedItems
      .map((item) => item.nextCheckAt)
      .filter((value) => Number.isFinite(value) && value > 0);
    const lastCheckedValues = normalizedItems
      .map((item) => item.lastChecked)
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      total: normalizedItems.length,
      unseenDrops: normalizedItems.filter((item) => item.hasUnseenDrop).length,
      unavailable: normalizedItems.filter((item) => item.available === false).length,
      due: normalizedItems.filter((item) => item.nextCheckAt == null || item.nextCheckAt <= now).length,
      withNotes: normalizedItems.filter((item) => item.notes).length,
      withTags: normalizedItems.filter((item) => Array.isArray(item.tags) && item.tags.length).length,
      nextCheckAt: nextCheckValues.length ? Math.min(...nextCheckValues) : null,
      lastCheckedAt: lastCheckedValues.length ? Math.max(...lastCheckedValues) : null
    };
  }

  function matchesTrackedListingQuery(item, query) {
    const normalized = normalizeStoredListing(item);
    const search = cleanText(query).toLowerCase();

    if (!search) {
      return true;
    }

    const haystack = [
      normalized.title,
      normalized.sellerName,
      normalized.categoryLabel,
      normalized.url,
      normalized.notes,
      ...(Array.isArray(normalized.tags) ? normalized.tags : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  }

  function filterTrackedListings(items, options = {}) {
    const normalizedItems = Array.isArray(items) ? items.map(normalizeStoredListing) : [];
    const query = options.query || "";
    const filter = options.filter || "all";
    const now = Number(options.now) || Date.now();

    return normalizedItems.filter((item) => {
      if (!matchesTrackedListingQuery(item, query)) {
        return false;
      }

      if (filter === "drops") {
        return item.hasUnseenDrop || item.status === STATUS.DROPPED;
      }

      if (filter === "unavailable") {
        return item.available === false;
      }

      if (filter === "due") {
        return item.nextCheckAt == null || item.nextCheckAt <= now;
      }

      if (filter === "notes") {
        return Boolean(item.notes || (item.tags && item.tags.length));
      }

      return true;
    });
  }

  function sortTrackedListings(items, sortKey = "recent") {
    const normalizedItems = Array.isArray(items) ? items.map(normalizeStoredListing) : [];
    const sorted = normalizedItems.slice();

    sorted.sort((first, second) => {
      if (sortKey === "title") {
        return first.title.localeCompare(second.title);
      }

      if (sortKey === "lastChecked") {
        return (second.lastChecked || 0) - (first.lastChecked || 0);
      }

      if (sortKey === "priceLow") {
        const firstPrice = first.currentPrice == null ? Number.POSITIVE_INFINITY : first.currentPrice;
        const secondPrice = second.currentPrice == null ? Number.POSITIVE_INFINITY : second.currentPrice;
        return firstPrice - secondPrice || second.dateTracked - first.dateTracked;
      }

      if (sortKey === "biggestDrop") {
        const firstDelta = first.lastPrice != null && first.currentPrice != null ? first.lastPrice - first.currentPrice : Number.NEGATIVE_INFINITY;
        const secondDelta = second.lastPrice != null && second.currentPrice != null ? second.lastPrice - second.currentPrice : Number.NEGATIVE_INFINITY;
        return secondDelta - firstDelta || second.dateTracked - first.dateTracked;
      }

      if (sortKey === "oldest") {
        return first.dateTracked - second.dateTracked;
      }

      return second.dateTracked - first.dateTracked;
    });

    return sorted;
  }

  function getMissingDiagnosticFields(listing) {
    if (!listing) {
      return ["title", "price", "seller", "category"];
    }

    const missing = [];

    if (!listing.title) {
      missing.push("title");
    }

    if (listing.price == null && !listing.priceText) {
      missing.push("price");
    }

    if (!listing.sellerName) {
      missing.push("seller");
    }

    if (!listing.categoryLabel) {
      missing.push("category");
    }

    return missing;
  }

  const DONATION_URL = getPreferredDonationLink();

  global.BolhaTrackerUtils = {
    STORAGE_KEY,
    SETTINGS_KEY,
    EXPORT_VERSION,
    HISTORY_LIMIT,
    MAX_SAVED_VIEWS,
    ALARM_NAME,
    DONATION_URLS,
    DONATION_URL,
    STATUS,
    STATUS_META,
    DEFAULT_SETTINGS,
    REFRESH_INTERVALS,
    BOLHA_PAGE_CONFIG,
    MESSAGE_TYPES,
    cleanText,
    safeJsonParse,
    normalizeUrl,
    isBolhaUrl,
    isLikelyListingUrl,
    toAbsoluteUrl,
    parsePriceText,
    formatCurrency,
    formatDateTime,
    isValidPayPalMeLink,
    buildPayPalMeLink,
    getPreferredDonationLink,
    getListingId,
    sanitizeSettings,
    getSettings,
    saveSettings,
    normalizeTags,
    normalizeSavedViews,
    extractListingFromHtml,
    extractListingFromDocument,
    normalizeStoredListing,
    createTrackedListing,
    mergeTrackedListing,
    getNextCheckAt,
    createRefreshFailureItem,
    markDropDetected,
    applyScheduledMetadata,
    shouldNotifyPriceDrop,
    markDropNotificationSent,
    markDropsSeen,
    getUnseenDropCount,
    getPriceDelta,
    getPriceSeries,
    getPriceAnalytics,
    buildSparklinePath,
    getTrackedListings,
    saveTrackedListings,
    findTrackedListingByUrl,
    removeTrackedListing,
    createExportPayload,
    normalizeImportPayload,
    mergeImportedData,
    getTrackedListingStats,
    matchesTrackedListingQuery,
    filterTrackedListings,
    sortTrackedListings,
    getMissingDiagnosticFields
  };
})(globalThis);
