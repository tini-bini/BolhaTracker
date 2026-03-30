const {
  MESSAGE_TYPES,
  extractListingFromDocument
} = globalThis.BolhaTrackerUtils;

function getCurrentPageListing() {
  return extractListingFromDocument(document, window.location.href);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === MESSAGE_TYPES.GET_PAGE_LISTING) {
    try {
      const listing = getCurrentPageListing();
      sendResponse({
        ok: true,
        listing
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || "Te strani na Bolhi ni bilo mogoče prebrati."
      });
    }
  }

  return false;
});
