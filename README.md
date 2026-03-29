# BOLHA Price Tracker

Production-ready Chrome MV3 extension for tracking Bolha.com listing prices locally, reviewing watchlist trends, and receiving drop notifications without sending user data to a backend.

## Product Summary

- Product type: Chrome browser extension
- Target runtime: Google Chrome 114+
- Target users: Bolha shoppers, resellers, and deal hunters who want a local-first watchlist
- Main flows:
  1. Open a Bolha listing and add it to the watchlist
  2. Review, search, filter, annotate, and refresh tracked listings from the popup
  3. Manage settings, cloud backup, diagnostics, presets, and analytics from the options page

## Architecture Summary

- `utils.js`: shared domain logic, storage normalization, PayPal link safety, filtering, sorting, analytics, import/export
- `service-worker.js`: background orchestration, scheduled refresh, notifications, sync backup, and runtime message handling
- `content.js`: active-tab listing extraction bridge
- `panel.js` + `panel.css`: injected in-page tracker panel for listing pages
- `popup.html` + `popup.js` + `popup.css`: primary watchlist command center
- `options.html` + `options.js` + `options.css`: operations dashboard, diagnostics, backup, presets, and analytics
- `i18n.js`: localized copy and user-facing formatting helpers
- `scripts/`: release validation, lint, typecheck, and packaging tooling
- `tests/`: critical-path automated tests

## Local Development

1. Clone the repo.
2. In Chrome, open `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select the repository root.

No environment variables are required for the current local-first release.

## Release Tooling

The repo ships self-contained validation and packaging scripts that use Python plus the repo-local Node runtime in `.tools/` when available.

- Lint: `python scripts/lint.py`
- Typecheck: `python scripts/typecheck.py`
- Test: `.\.tools\node-v22.15.0-win-x64\node.exe --test tests`
- Build release zip: `python scripts/build_release.py`
- Full release validation: `python scripts/validate_release.py`

## Verification Coverage

- JavaScript syntax validation for every shipped `.js` file
- Runtime message contract coverage between `utils.js` and `service-worker.js`
- Popup/options DOM ID contract validation
- PayPal.Me validation helper coverage
- Critical logic tests for:
  - PayPal.Me validation and link generation
  - Saved view normalization
  - Watchlist filtering
  - Price analytics calculations

## PayPal.Me Handling

- Donation links are validated before use.
- Only `https://paypal.me/...` or `https://www.paypal.me/...` links are accepted.
- Links with query strings, fragments, wrong hosts, or malformed usernames are rejected.
- Popup and options donation CTAs are disabled if no valid link is configured.
- Current configured donation link: `https://paypal.me/TiniFlegar`

Manual payment verification still requires a browser session and PayPal availability. This repo implements the link generation and navigation paths, but it does not include PayPal account credentials or live payment automation.

## Cloud Backup

- Optional Chrome sync backup is available from the options page.
- Backup stores the exported watchlist payload in chunked sync storage.
- Restore uses the same normalized import path as manual JSON import.

## Release Steps

1. Run `python scripts/validate_release.py`
2. Confirm the artifact path printed by `build_release.py`
3. Open the zip in `dist/`
4. Upload the zip manually to the Chrome Web Store Developer Dashboard

## Manual Chrome Web Store Upload Checklist

See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Repository Hygiene

- Generated zips and local tooling caches are ignored via `.gitignore`
- No secrets or credentials are stored in the repository
- Current release artifact is generated on demand and not committed
