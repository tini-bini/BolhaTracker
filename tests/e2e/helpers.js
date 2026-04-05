const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { chromium, expect } = require("@playwright/test");
const { createApp, createAppContext } = require("../../server/app.js");

const EXTENSION_ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE_ROOT = path.resolve(__dirname, "..", "fixtures", "bolha");

const FIXTURES = {
  "/oglasi/ergonomski-stol-oglas-111111": fs.readFileSync(path.join(FIXTURE_ROOT, "active-listing.html"), "utf8"),
  "/oglasi/gaming-monitor-oglas-222222": fs.readFileSync(path.join(FIXTURE_ROOT, "variant-listing.html"), "utf8"),
  "/oglasi/rabljeno-kolo-oglas-333333": fs.readFileSync(path.join(FIXTURE_ROOT, "unavailable-listing.html"), "utf8"),
  "/": fs.readFileSync(path.join(FIXTURE_ROOT, "non-listing.html"), "utf8")
};

function trackErrors(page) {
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror:${error.message}`);
  });

  return errors;
}

async function expectNoErrors(errors, label) {
  expect(errors, label || "No console or page errors were expected").toEqual([]);
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function startPremiumServer(overrides = {}) {
  const port = overrides.port || await getAvailablePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bolha-premium-e2e-"));
  const dbPath = overrides.dbPath || path.join(tempDir, "entitlements.sqlite");
  const context = createAppContext({
    rootDir: EXTENSION_ROOT,
    config: {
      paymentProvider: "mock",
      baseUrl: `http://127.0.0.1:${port}`,
      dbPath,
      ...(overrides.config || {})
    }
  });
  const app = createApp({ context });
  const server = await new Promise((resolve) => {
    const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dbPath,
    server,
    context,
    async dispose() {
      context.store.close();
      await new Promise((resolve) => server.close(() => resolve()));
      if (!overrides.dbPath) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  };
}

async function launchExtension(options = {}) {
  const userDataDir = options.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), "bolha-extension-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: options.headless ?? (process.env.PLAYWRIGHT_HEADLESS !== "0"),
    args: [
      `--disable-extensions-except=${EXTENSION_ROOT}`,
      `--load-extension=${EXTENSION_ROOT}`
    ]
  });

  const background = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const extensionId = new URL(background.url()).host;

  return {
    context,
    extensionId,
    userDataDir,
    async dispose() {
      await context.close();
      if (!options.userDataDir) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    }
  };
}

async function routeBolhaFixtures(context) {
  await context.route("https://www.bolha.com/**", async (route) => {
    const url = new URL(route.request().url());
    const body = FIXTURES[url.pathname];

    if (body) {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Not Found</title><p>Fixture not found.</p>"
    });
  });
}

async function openExtensionPage(context, extensionId, pageName) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${pageName}`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

async function openBolhaPage(context, urlPath) {
  const page = await context.newPage();
  await page.goto(`https://www.bolha.com${urlPath}`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

async function getPanelText(page) {
  return page.locator("#bolha-tracker-host .panel").innerText();
}

module.exports = {
  expectNoErrors,
  getPanelText,
  launchExtension,
  openBolhaPage,
  openExtensionPage,
  routeBolhaFixtures,
  startPremiumServer,
  trackErrors
};
