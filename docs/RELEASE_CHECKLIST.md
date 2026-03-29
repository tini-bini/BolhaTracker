# Release Checklist

## Pre-upload

1. Run `python scripts/validate_release.py`
2. Confirm `dist/bolha-price-tracker-v1.0.0.zip` exists
3. Load the unpacked extension in Chrome and smoke-test:
   - popup opens
   - current page listing detection works on a real Bolha listing
   - track, refresh, remove, and notes/tag save flows work
   - donation button opens the PayPal.Me page
   - options page opens and cloud backup buttons render correctly
4. Confirm the extension icon assets render correctly at 16/32/48/128 sizes

## Chrome Web Store Dashboard Upload

1. Open the Chrome Web Store Developer Dashboard
2. Choose the existing item or create a new listing
3. Upload `dist/bolha-price-tracker-v1.0.0.zip`
4. Verify the auto-detected permissions:
   - `storage`
   - `notifications`
   - `alarms`
   - `tabs`
   - host permission for `https://www.bolha.com/*`
5. Update the listing copy/screenshots if needed
6. Submit for review

## Manual Inputs Still Required

- Chrome Web Store listing metadata and screenshots
- Store description localization, if you want dashboard-managed copy beyond the extension UI text
- Final publisher review and submission confirmation in the dashboard

## Manual PayPal Verification

1. Load the extension in Chrome
2. Open popup, options page, and in-page panel on a Bolha listing
3. Click each donation CTA
4. Confirm the browser opens `https://paypal.me/TiniFlegar`
5. Confirm the CTA is disabled if the configured link is removed or intentionally malformed in `utils.js`
