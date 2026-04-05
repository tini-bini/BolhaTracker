const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  expectNoErrors,
  launchExtension,
  openExtensionPage,
  routeBolhaFixtures,
  startPremiumServer,
  trackErrors
} = require("./helpers");

async function completeMockCheckout(context, optionsPage, result) {
  await expect(optionsPage.locator("#premium-status-card")).toContainText("Koda namestitve");
  await expect(optionsPage.locator("#buy-premium-button")).toBeEnabled();
  await optionsPage.locator("#buy-premium-button").click();
  await expect(optionsPage.locator("#toast")).toContainText("Checkout");
  const entitlement = await optionsPage.evaluate(async () => {
    const stored = await chrome.storage.local.get("trackerEntitlement");
    return stored.trackerEntitlement || null;
  });

  if (!entitlement || !entitlement.checkoutUrl) {
    throw new Error("Checkout session was not stored in extension state.");
  }

  let checkoutPage = context.pages().find((page) => page.url() === entitlement.checkoutUrl) || null;

  if (!checkoutPage) {
    checkoutPage = await context.newPage();
    await checkoutPage.goto(entitlement.checkoutUrl);
  }

  await checkoutPage.waitForLoadState("domcontentloaded");
  await checkoutPage.locator('input[name="email"]').fill("buyer@example.com");

  if (result === "success") {
    await checkoutPage.getByRole("button", { name: "Complete payment" }).click();
  } else if (result === "failed") {
    await checkoutPage.getByRole("button", { name: "Fail payment" }).click();
  } else {
    await checkoutPage.getByRole("button", { name: "Cancel payment" }).click();
  }

  await checkoutPage.waitForLoadState("domcontentloaded");
  return checkoutPage;
}

async function configureBackend(optionsPage, baseUrl) {
  await optionsPage.evaluate(async (apiBaseUrl) => {
    await chrome.storage.local.set({
      trackerBackendConfig: {
        apiBaseUrl
      }
    });
  }, baseUrl);
}

test("free-to-premium upgrade unlocks premium and survives browser restart via cached entitlement", async () => {
  const server = await startPremiumServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bolha-extension-restart-"));
  const firstLaunch = await launchExtension({ userDataDir });

  try {
    await routeBolhaFixtures(firstLaunch.context);
    const optionsPage = await openExtensionPage(firstLaunch.context, firstLaunch.extensionId, "options.html");
    const errors = trackErrors(optionsPage);
    await configureBackend(optionsPage, server.baseUrl);

    await completeMockCheckout(firstLaunch.context, optionsPage, "success");
    await optionsPage.bringToFront();
    await optionsPage.locator("#already-paid-button").click();
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Premium");
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Koda za obnovo");

    await expectNoErrors(errors, "Upgrade flow should not emit console errors");
    await firstLaunch.dispose();

    const secondLaunch = await launchExtension({ userDataDir });
    try {
      await routeBolhaFixtures(secondLaunch.context);
      const reopenedOptions = await openExtensionPage(secondLaunch.context, secondLaunch.extensionId, "options.html");
      await configureBackend(reopenedOptions, server.baseUrl);
      await expect(reopenedOptions.locator("#premium-status-card")).toContainText("Premium");
      await expect(reopenedOptions.locator("#premium-status-card")).toContainText("Koda za obnovo");
    } finally {
      await secondLaunch.dispose();
    }
  } finally {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      // Chromium can keep a transient handle open on Windows for a moment after shutdown.
    }
    await server.dispose();
  }
});

test("restore purchase works on a new profile with purchase email and restore code", async () => {
  const server = await startPremiumServer();
  const firstLaunch = await launchExtension();

  try {
    await routeBolhaFixtures(firstLaunch.context);
    const optionsPage = await openExtensionPage(firstLaunch.context, firstLaunch.extensionId, "options.html");
    await configureBackend(optionsPage, server.baseUrl);
    await completeMockCheckout(firstLaunch.context, optionsPage, "success");
    await optionsPage.bringToFront();
    await optionsPage.locator("#already-paid-button").click();
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Koda za obnovo");
    const entitlement = await optionsPage.evaluate(async () => {
      const stored = await chrome.storage.local.get("trackerEntitlement");
      return stored.trackerEntitlement || null;
    });
    expect(entitlement && entitlement.restoreCode).toBeTruthy();
    const restoreCode = entitlement.restoreCode;

    const secondLaunch = await launchExtension();
    try {
      await routeBolhaFixtures(secondLaunch.context);
      const secondOptions = await openExtensionPage(secondLaunch.context, secondLaunch.extensionId, "options.html");
      const restoreErrors = trackErrors(secondOptions);
      await configureBackend(secondOptions, server.baseUrl);

      await secondOptions.locator('#premium-status-card [data-premium-field="email"]').fill("buyer@example.com");
      await secondOptions.locator('#premium-status-card [data-premium-field="restoreCode"]').fill(restoreCode);
      await secondOptions.locator("#already-paid-button").click();

      await expect(secondOptions.locator("#premium-status-card")).toContainText("Premium");
      await expect(secondOptions.locator("#premium-status-card")).toContainText("buyer@example.com".replace("yer", "***"));
      await expectNoErrors(restoreErrors, "Restore flow should not emit console errors");
    } finally {
      await secondLaunch.dispose();
    }
  } finally {
    await firstLaunch.dispose();
    await server.dispose();
  }
});

test("payment failure and cancellation both resolve to clear non-premium states", async () => {
  const server = await startPremiumServer();
  const extension = await launchExtension();

  try {
    await routeBolhaFixtures(extension.context);
    const optionsPage = await openExtensionPage(extension.context, extension.extensionId, "options.html");
    await configureBackend(optionsPage, server.baseUrl);

    await completeMockCheckout(extension.context, optionsPage, "failed");
    await optionsPage.bringToFront();
    await optionsPage.locator("#already-paid-button").click();
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Plačilo ni uspelo");
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Mock card failure");

    await completeMockCheckout(extension.context, optionsPage, "cancelled");
    await optionsPage.bringToFront();
    await optionsPage.locator("#already-paid-button").click();
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Preklicano");
  } finally {
    await extension.dispose();
    await server.dispose();
  }
});

test("API failures surface as stable entitlement errors instead of silent breakage", async () => {
  const server = await startPremiumServer();
  const extension = await launchExtension();

  try {
    await routeBolhaFixtures(extension.context);
    const optionsPage = await openExtensionPage(extension.context, extension.extensionId, "options.html");

    await optionsPage.evaluate(async () => {
      await chrome.storage.local.set({
        trackerBackendConfig: {
          apiBaseUrl: "http://127.0.0.1:9"
        }
      });
    });

    await optionsPage.locator("#already-paid-button").click();
    await expect(optionsPage.locator("#premium-status-card")).toContainText("Zadnja napaka");
    await expect(optionsPage.locator("#premium-status-card")).toContainText("premium strežnikom");
  } finally {
    await extension.dispose();
    await server.dispose();
  }
});
