const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { createSignedEntitlementEnvelope } = require("../server/signing.js");
const { loadConfig } = require("../server/config.js");

function loadRuntime() {
  const localStore = {};
  const context = {
    console,
    URL,
    Intl,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    RegExp,
    JSON,
    TextEncoder,
    Uint8Array,
    Buffer,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    atob(value) {
      return Buffer.from(String(value || ""), "base64").toString("binary");
    },
    btoa(value) {
      return Buffer.from(String(value || ""), "binary").toString("base64");
    },
    globalThis: null,
    chrome: {
      storage: {
        local: {
          async get(key) {
            if (typeof key === "string") {
              return { [key]: localStore[key] };
            }

            return { ...localStore };
          },
          async set(values) {
            Object.assign(localStore, values || {});
            return {};
          }
        }
      }
    }
  };

  context.globalThis = context;
  vm.createContext(context);

  for (const fileName of ["utils.js", "i18n.js"]) {
    const source = fs.readFileSync(path.resolve(fileName), "utf8");
    vm.runInContext(source, context, { filename: fileName });
  }

  return context;
}

test("PayPal.Me links are validated safely", () => {
  const runtime = loadRuntime();
  const { isValidPayPalMeLink } = runtime.BolhaTrackerUtils;

  assert.equal(isValidPayPalMeLink("https://paypal.me/TiniFlegar"), true);
  assert.equal(isValidPayPalMeLink("https://www.paypal.me/TiniFlegar/25"), true);
  assert.equal(isValidPayPalMeLink("http://paypal.me/TiniFlegar"), false);
  assert.equal(isValidPayPalMeLink("https://paypal.me/TiniFlegar?foo=bar"), false);
  assert.equal(isValidPayPalMeLink("https://example.com/TiniFlegar"), false);
});

test("PayPal.Me link generation appends amount safely", () => {
  const runtime = loadRuntime();
  const { buildPayPalMeLink } = runtime.BolhaTrackerUtils;

  assert.equal(
    buildPayPalMeLink("https://paypal.me/TiniFlegar", 5),
    "https://paypal.me/TiniFlegar/5"
  );
  assert.equal(
    buildPayPalMeLink("https://paypal.me/TiniFlegar", 19.99, "eur"),
    "https://paypal.me/TiniFlegar/19.99EUR"
  );
  assert.equal(buildPayPalMeLink("https://paypal.me/TiniFlegar", 0), null);
});

test("Signed entitlement envelopes unlock premium only for the bound install", async () => {
  const runtime = loadRuntime();
  const {
    PLAN,
    ENTITLEMENT_STATUS,
    PREMIUM_LIFETIME_PRICE,
    PREMIUM_LIFETIME_CURRENCY,
    getEntitlementState,
    isPremiumEntitled,
    saveEntitlementState
  } = runtime.BolhaTrackerUtils;
  const config = loadConfig(process.cwd());

  assert.equal(PREMIUM_LIFETIME_PRICE, 4.99);
  assert.equal(PREMIUM_LIFETIME_CURRENCY, "EUR");

  const before = await getEntitlementState();
  const envelope = createSignedEntitlementEnvelope({
    id: "cs_test_bound",
    customerEmail: "buyer@example.com",
    restoreCode: "RESTORE1"
  }, before.installCode, config);
  await saveEntitlementState({
    plan: PLAN.PREMIUM_LIFETIME,
    status: ENTITLEMENT_STATUS.PREMIUM_ACTIVE,
    entitlementEnvelope: envelope
  });
  const activated = await getEntitlementState();

  assert.equal(activated.plan, PLAN.PREMIUM_LIFETIME);
  assert.equal(activated.status, ENTITLEMENT_STATUS.PREMIUM_ACTIVE);
  assert.equal(isPremiumEntitled(activated), true);
  assert.ok(Number.isFinite(activated.paymentAcknowledgedAt));
  assert.ok(Number.isFinite(activated.premiumActivatedAt));
  assert.equal(activated.restoreCode, "RESTORE1");
  assert.equal(activated.maskedEmail, "bu***@example.com");
  assert.equal(activated.installCode, before.installCode);
});

test("Pending checkout turns into verification-pending on sync error and invalid signed payload is rejected", async () => {
  const runtime = loadRuntime();
  const {
    ENTITLEMENT_STATUS,
    markCheckoutPending,
    saveEntitlementState,
    getEntitlementState,
    setEntitlementSyncError,
    shouldRefreshEntitlement
  } = runtime.BolhaTrackerUtils;
  const config = loadConfig(process.cwd());

  const pending = await markCheckoutPending("cs_pending", "http://127.0.0.1:8787/mock/checkout/cs_pending", "stripe");
  assert.equal(pending.status, ENTITLEMENT_STATUS.CHECKOUT_PENDING);
  assert.equal(shouldRefreshEntitlement(pending), true);

  const errored = await setEntitlementSyncError("Network timeout");
  assert.equal(errored.status, ENTITLEMENT_STATUS.VERIFICATION_PENDING);
  assert.equal(errored.lastError, "Network timeout");

  const current = await getEntitlementState();
  const invalidEnvelope = createSignedEntitlementEnvelope({
    id: "cs_wrong_install",
    customerEmail: "buyer@example.com",
    restoreCode: "RESTORE2"
  }, "bolha-some-other-install", config);
  await saveEntitlementState({
    installCode: current.installCode,
    status: ENTITLEMENT_STATUS.PREMIUM_ACTIVE,
    entitlementEnvelope: invalidEnvelope
  });

  const hydrated = await getEntitlementState();
  assert.equal(hydrated.status, ENTITLEMENT_STATUS.ENTITLEMENT_INVALID);
  assert.equal(hydrated.lastError, "Entitlement ni vezan na to namestitev.");
});

test("Saved views are normalized and deduplicated", () => {
  const runtime = loadRuntime();
  const { normalizeSavedViews } = runtime.BolhaTrackerUtils;

  const normalized = normalizeSavedViews([
    { id: "a", name: "Drops", query: "chair", filter: "drops", sort: "biggestDrop" },
    { id: "a", name: "Duplicate", query: "", filter: "all", sort: "recent" },
    { name: "   ", query: "", filter: "invalid", sort: "invalid" }
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(JSON.stringify(normalized[0]), JSON.stringify({
    id: "a",
    name: "Drops",
    query: "chair",
    filter: "drops",
    sort: "biggestDrop"
  }));
});

test("Tracked listing filters and analytics cover critical flows", () => {
  const runtime = loadRuntime();
  const { filterTrackedListings, getPriceAnalytics, normalizeStoredListing } = runtime.BolhaTrackerUtils;

  const now = Date.now();
  const items = [
    normalizeStoredListing({
      id: "tracked-1",
      url: "https://www.bolha.com/a-oglas-1",
      title: "Office chair",
      tags: ["desk"],
      notes: "Seller called back",
      hasUnseenDrop: true,
      status: "dropped",
      nextCheckAt: now - 1000,
      currentPrice: 80,
      lastPrice: 120,
      priceHistory: [
        { timestamp: now - 3000, price: 120, available: true, status: "unchanged" },
        { timestamp: now - 2000, price: 100, available: true, status: "dropped" },
        { timestamp: now - 1000, price: 80, available: true, status: "dropped" }
      ]
    }),
    normalizeStoredListing({
      id: "tracked-2",
      url: "https://www.bolha.com/a-oglas-2",
      title: "Standing desk",
      currentPrice: 220,
      lastPrice: 220,
      nextCheckAt: now + 60000
    })
  ];

  assert.equal(filterTrackedListings(items, { filter: "drops" }).length, 1);
  assert.equal(filterTrackedListings(items, { filter: "notes" }).length, 1);
  assert.equal(filterTrackedListings(items, { query: "desk" }).length, 2);

  assert.equal(JSON.stringify(getPriceAnalytics(items[0])), JSON.stringify({
    sampleCount: 3,
    low: 80,
    high: 120,
    average: 100,
    firstPrice: 120,
    lastPrice: 80,
    delta: -40,
    percentChange: -33.33333333333333
  }));
});

test("Premium entitlement gates scale and advanced features cleanly", () => {
  const runtime = loadRuntime();
  const {
    PLAN,
    PREMIUM_FEATURES,
    FREE_LIMITS,
    getFeatureAvailability,
    clampSettingsToEntitlement
  } = runtime.BolhaTrackerUtils;

  const freeTracked = getFeatureAvailability(PREMIUM_FEATURES.TRACKED_LISTINGS, { plan: PLAN.FREE }, {
    trackedCount: FREE_LIMITS.trackedListings
  });
  const premiumTracked = getFeatureAvailability(PREMIUM_FEATURES.TRACKED_LISTINGS, { plan: PLAN.PREMIUM_LIFETIME }, {
    trackedCount: FREE_LIMITS.trackedListings + 20
  });
  const freeBulkRefresh = getFeatureAvailability(PREMIUM_FEATURES.BULK_REFRESH, { plan: PLAN.FREE });

  assert.equal(freeTracked.allowed, false);
  assert.equal(freeTracked.limit, FREE_LIMITS.trackedListings);
  assert.equal(premiumTracked.allowed, true);
  assert.equal(freeBulkRefresh.allowed, false);

  const clamped = clampSettingsToEntitlement({
    savedViews: [
      { id: "a", name: "One", query: "", filter: "all", sort: "recent" },
      { id: "b", name: "Two", query: "", filter: "all", sort: "recent" }
    ]
  }, { plan: PLAN.FREE });

  assert.equal(clamped.savedViews.length, 1);
});

test("Unsafe URLs are rejected before navigation or scraping use", () => {
  const runtime = loadRuntime();
  const { isSafeWebUrl, normalizeUrl, toAbsoluteUrl } = runtime.BolhaTrackerUtils;

  assert.equal(isSafeWebUrl("https://www.bolha.com/oglas-123"), true);
  assert.equal(isSafeWebUrl("javascript:alert(1)"), false);
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
  assert.equal(toAbsoluteUrl("javascript:alert(1)", "https://www.bolha.com/"), null);
});
