import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadRuntime() {
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
    setTimeout,
    clearTimeout,
    globalThis: null,
    chrome: {
      storage: {
        local: {
          async get() {
            return {};
          },
          async set() {
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
