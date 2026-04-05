const { test, expect } = require("@playwright/test");
const {
  expectNoErrors,
  getPanelText,
  launchExtension,
  openBolhaPage,
  openExtensionPage,
  routeBolhaFixtures,
  startPremiumServer,
  trackErrors
} = require("./helpers");

test("@smoke extension pages, storage, messaging, and Bolha site variants work without console errors", async () => {
  const server = await startPremiumServer();
  const extension = await launchExtension();

  try {
    await routeBolhaFixtures(extension.context);

    const activePage = await openBolhaPage(extension.context, "/oglasi/ergonomski-stol-oglas-111111");
    const activeErrors = trackErrors(activePage);
    await expect(activePage.locator("#bolha-tracker-host .panel")).toBeVisible();
    await expect(activePage.locator("#bolha-tracker-host .p-title")).toContainText("Ergonomski stol");
    await activePage.evaluate(() => {
      const host = document.getElementById("bolha-tracker-host");
      const button = host && host.shadowRoot ? host.shadowRoot.querySelector('[data-action="track"]') : null;
      if (!button) {
        throw new Error("Track button was not rendered inside the floating panel.");
      }
      button.click();
    });

    const unavailablePage = await openBolhaPage(extension.context, "/oglasi/rabljeno-kolo-oglas-333333");
    const unavailableErrors = trackErrors(unavailablePage);
    await expect(unavailablePage.locator("#bolha-tracker-host .panel")).toBeVisible();
    await expect(unavailablePage.locator("#bolha-tracker-host .p-actions")).toContainText("Ni na voljo");

    const variantPage = await openBolhaPage(extension.context, "/oglasi/gaming-monitor-oglas-222222");
    const variantErrors = trackErrors(variantPage);
    await expect(variantPage.locator("#bolha-tracker-host .panel")).toBeVisible();
    await expect(await getPanelText(variantPage)).toContain("Gaming monitor 27");

    const nonListingPage = await openBolhaPage(extension.context, "/");
    const nonListingErrors = trackErrors(nonListingPage);
    await expect(nonListingPage.locator("#bolha-tracker-host")).toHaveCount(0);

    const popupPage = await openExtensionPage(extension.context, extension.extensionId, "popup.html");
    const popupErrors = trackErrors(popupPage);
    await expect(popupPage.locator("#header-title")).toContainText("BOLHA Sledilnik cen");
    await expect(popupPage.locator("#premium-panel")).toContainText("Lifetime Premium");

    const optionsPage = await openExtensionPage(extension.context, extension.extensionId, "options.html");
    const optionsErrors = trackErrors(optionsPage);
    await expect(optionsPage.locator("#hero-title")).toContainText("Nastavitve");
    await optionsPage.locator("#scheduled-refresh").setChecked(false, { force: true });
    await optionsPage.locator("#save-settings-button").click();
    await expect(optionsPage.locator("#toast")).toContainText("nastavitve", { ignoreCase: true });
    await optionsPage.reload();
    await expect(optionsPage.locator("#scheduled-refresh")).not.toBeChecked();
    await expect(optionsPage.locator("#overview-grid")).toContainText("1");

    await expectNoErrors(activeErrors, "Active listing page should stay clean");
    await expectNoErrors(unavailableErrors, "Unavailable listing page should stay clean");
    await expectNoErrors(variantErrors, "Selector variant page should stay clean");
    await expectNoErrors(nonListingErrors, "Non-listing page should stay clean");
    await expectNoErrors(popupErrors, "Popup page should stay clean");
    await expectNoErrors(optionsErrors, "Options page should stay clean");
  } finally {
    await extension.dispose();
    await server.dispose();
  }
});
