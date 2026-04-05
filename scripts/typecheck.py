from __future__ import annotations

import re
from pathlib import Path

from release_helpers import ROOT, print_step


HTML_JS_PAIRS = [("popup.html", "popup.js"), ("options.html", "options.js")]


def extract_ids(html_source: str) -> set[str]:
    return set(re.findall(r'id="([^"]+)"', html_source))


def extract_get_element_ids(js_source: str) -> set[str]:
    return set(re.findall(r'getElementById\("([^"]+)"\)', js_source))


def ensure_dom_contracts() -> None:
    dynamic_ids = {
        "dismiss-onboarding-button",
        "onboarding-settings-button",
        "track-current-button",
        "buy-premium-button",
        "already-paid-button",
        "copy-premium-request-button",
        "premium-restore-email",
        "premium-restore-code",
    }

    for html_name, js_name in HTML_JS_PAIRS:
        html_ids = extract_ids((ROOT / html_name).read_text(encoding="utf-8"))
        js_ids = extract_get_element_ids((ROOT / js_name).read_text(encoding="utf-8"))
        missing = sorted(js_ids - html_ids - dynamic_ids)
        if missing:
            raise SystemExit(f"{js_name} references missing DOM ids: {', '.join(missing)}")


def ensure_message_types_are_handled() -> None:
    utils_source = (ROOT / "utils.js").read_text(encoding="utf-8")
    worker_source = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    message_types = set(re.findall(r"([A-Z_]+): \"\\1\"", utils_source))
    handled_types = set(re.findall(r"MESSAGE_TYPES\.([A-Z_]+)", worker_source))
    missing = sorted(message_types - handled_types - {"GET_PAGE_LISTING"})
    if missing:
        raise SystemExit(f"Unhandled runtime message types: {', '.join(missing)}")


def ensure_paypal_configuration_is_safe() -> None:
    utils_source = (ROOT / "utils.js").read_text(encoding="utf-8")
    if "function isValidPayPalMeLink" not in utils_source or "function buildPayPalMeLink" not in utils_source:
        raise SystemExit("PayPal.Me validation helpers are missing.")


def ensure_no_client_side_premium_unlock() -> None:
    for path in ("popup.js", "options.js", "panel.js", "service-worker.js", "utils.js"):
        source = (ROOT / path).read_text(encoding="utf-8")
        if "activatePremiumLifetime(" in source:
            raise SystemExit(f"Insecure client-side premium activation remains in {path}.")


def main() -> None:
    print_step("checking DOM contracts")
    ensure_dom_contracts()
    print_step("checking runtime message coverage")
    ensure_message_types_are_handled()
    print_step("checking PayPal.Me validation hooks")
    ensure_paypal_configuration_is_safe()
    print_step("checking premium activation hardening")
    ensure_no_client_side_premium_unlock()
    print("typecheck ok")


if __name__ == "__main__":
    main()
