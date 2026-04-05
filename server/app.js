const express = require("express");
const path = require("node:path");
const { createStore } = require("./db");
const { loadConfig } = require("./config");
const { createSignedEntitlementEnvelope } = require("./signing");
const { createPaymentService, maskEmail } = require("./payments");

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readJsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function createAppContext(overrides = {}) {
  const rootDir = overrides.rootDir || path.resolve(__dirname, "..");
  const config = {
    ...loadConfig(rootDir),
    ...(overrides.config || {})
  };

  if (!config.signingPrivateKeyPem) {
    throw new Error("Signing private key is required for entitlement envelopes.");
  }

  const store = overrides.store || createStore(config.dbPath);
  const payments = createPaymentService(config, store);
  return { config, store, payments };
}

function createResolveResponse(context, installCode) {
  const resolved = context.payments.getResolveState(installCode);

  if (resolved.status === "premium_active" && resolved.session) {
    return {
      ok: true,
      status: "premium_active",
      plan: "premium_lifetime",
      checkoutSessionId: resolved.session.id,
      maskedEmail: resolved.maskedEmail,
      restoreCode: resolved.session.restoreCode,
      envelope: createSignedEntitlementEnvelope(resolved.session, installCode, context.config)
    };
  }

  return {
    ok: true,
    status: resolved.status,
    plan: "free",
    checkoutSessionId: resolved.session ? resolved.session.id : null,
    maskedEmail: resolved.maskedEmail,
    restoreCode: resolved.session ? resolved.session.restoreCode : null,
    envelope: null,
    failureReason: resolved.session ? resolved.session.failureReason : null
  };
}

function createApp(overrides = {}) {
  const context = overrides.context || createAppContext(overrides);
  const app = express();

  app.disable("x-powered-by");
  app.locals.context = context;

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.post("/api/webhooks/stripe", express.raw({ type: "*/*" }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      provider: context.config.paymentProvider,
      signingKeyId: context.config.signingKeyId
    });
  });

  app.post("/api/checkout/session", async (req, res) => {
    const body = readJsonBody(req);
    const installCode = String(body.installCode || "").trim();
    const requestedPlan = body.plan === "premium_lifetime" ? "premium_lifetime" : "";

    if (!installCode || !requestedPlan) {
      res.status(400).json({
        ok: false,
        error: "Missing installCode or plan."
      });
      return;
    }

    try {
      const session = await context.payments.createCheckoutSession({
        installCode,
        requestedPlan
      });
      res.json({
        ok: true,
        status: "checkout_pending",
        checkoutSessionId: session.id,
        checkoutUrl: session.checkoutUrl
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message || "Checkout session could not be created."
      });
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      const signature = req.get("Stripe-Signature") || "";
      const result = await context.payments.handleStripeWebhook(signature, req.body);
      res.json({
        ok: true,
        sessionId: result ? result.id : null
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message || "Webhook validation failed."
      });
    }
  });

  app.post("/api/entitlements/resolve", (req, res) => {
    const body = readJsonBody(req);
    const installCode = String(body.installCode || "").trim();

    if (!installCode) {
      res.status(400).json({
        ok: false,
        error: "Missing installCode."
      });
      return;
    }

    res.json(createResolveResponse(context, installCode));
  });

  app.post("/api/entitlements/restore", (req, res) => {
    const body = readJsonBody(req);
    const installCode = String(body.installCode || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const restoreCode = String(body.restoreCode || "").trim().toUpperCase();

    if (!installCode || !email || !restoreCode) {
      res.status(400).json({
        ok: false,
        error: "Missing installCode, email, or restoreCode."
      });
      return;
    }

    const session = context.store.getPaidSessionForRestore(email, restoreCode);

    if (!session) {
      res.status(404).json({
        ok: false,
        error: "No paid purchase matches that email and restore code."
      });
      return;
    }

    try {
      context.payments.claimSessionForInstall(session, installCode, "restore");
      res.json(createResolveResponse(context, installCode));
    } catch (error) {
      res.status(409).json({
        ok: false,
        error: error.message || "Restore could not be completed."
      });
    }
  });

  app.get("/mock/checkout/:sessionId", (req, res) => {
    const session = context.store.getCheckoutById(req.params.sessionId);

    if (!session) {
      res.status(404).send("Checkout session not found.");
      return;
    }

    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Mock Stripe Checkout</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f4f7f9; color: #334047; }
      main { max-width: 680px; margin: 40px auto; background: white; border: 1px solid #d6e0e7; border-radius: 16px; box-shadow: 0 18px 36px rgba(30,48,60,.12); padding: 28px; }
      h1 { margin-top: 0; font-size: 28px; }
      p { line-height: 1.6; }
      label { display: grid; gap: 8px; margin: 18px 0; }
      input { min-height: 42px; border-radius: 10px; border: 1px solid #bfccd5; padding: 0 12px; font: inherit; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
      button { min-height: 42px; border-radius: 10px; border: 1px solid transparent; padding: 0 14px; font: inherit; cursor: pointer; }
      .ok { background: #16a7dc; color: white; }
      .cancel { background: white; border-color: #d6e0e7; }
      .fail { background: #ef0a87; color: white; }
      code { background: #eef4f8; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Mock Stripe Checkout</h1>
      <p>This local checkout page simulates the Stripe hosted flow for install <code>${escapeHtml(session.installCode)}</code>.</p>
      <form method="post" action="/mock/checkout/${encodeURIComponent(session.id)}/complete">
        <label>
          <span>Email</span>
          <input type="email" name="email" value="${escapeHtml(session.customerEmail || "buyer@example.com")}" required>
        </label>
        <div class="actions">
          <button class="ok" type="submit" name="result" value="success">Complete payment</button>
          <button class="fail" type="submit" name="result" value="failed">Fail payment</button>
          <button class="cancel" type="submit" name="result" value="cancelled">Cancel payment</button>
        </div>
      </form>
    </main>
  </body>
</html>`);
  });

  app.post("/mock/checkout/:sessionId/complete", (req, res) => {
    const session = context.store.getCheckoutById(req.params.sessionId);

    if (!session) {
      res.status(404).send("Checkout session not found.");
      return;
    }

    const result = String(req.body.result || "cancelled");
    const email = String(req.body.email || "").trim().toLowerCase();
    let next;

    if (result === "success") {
      next = context.payments.transitionSession(session.id, "premium_active", {
        customerEmail: email,
        eventId: `evt_mock_${session.id}_completed`,
        eventType: "checkout.session.completed"
      });
      context.store.upsertClaim(session.id, session.installCode, "checkout");
    } else if (result === "failed") {
      next = context.payments.transitionSession(session.id, "payment_failed", {
        customerEmail: email,
        eventId: `evt_mock_${session.id}_failed`,
        eventType: "payment_intent.payment_failed",
        failureReason: "Mock card failure"
      });
    } else {
      next = context.payments.transitionSession(session.id, "payment_cancelled", {
        customerEmail: email,
        eventId: `evt_mock_${session.id}_cancelled`,
        eventType: "checkout.session.expired"
      });
    }

    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Mock Stripe Result</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 0; background: #f4f7f9; color: #334047; }
      main { max-width: 680px; margin: 40px auto; background: white; border: 1px solid #d6e0e7; border-radius: 16px; box-shadow: 0 18px 36px rgba(30,48,60,.12); padding: 28px; }
      .pill { display: inline-flex; min-height: 28px; align-items: center; padding: 0 10px; border-radius: 999px; border: 1px solid #d6e0e7; background: #eef4f8; }
      code { background: #eef4f8; padding: 2px 6px; border-radius: 6px; }
      a { color: #16a7dc; }
    </style>
  </head>
  <body>
    <main>
      <h1>Checkout result: ${escapeHtml(next.status)}</h1>
      <p class="pill">${escapeHtml(maskEmail(next.customerEmail) || "no email")}</p>
      <p>Reopen the extension popup and sync premium status.</p>
      ${next.restoreCode ? `<p>Restore code: <code id="restore-code">${escapeHtml(next.restoreCode)}</code></p>` : ""}
      ${next.failureReason ? `<p>${escapeHtml(next.failureReason)}</p>` : ""}
      <p><a href="${escapeHtml(context.config.baseUrl)}">Back to backend</a></p>
    </main>
  </body>
</html>`);
  });

  app.get("/checkout/cancel", (req, res) => {
    const sessionId = String(req.query.session_id || "").trim();
    if (sessionId) {
      context.payments.transitionSession(sessionId, "payment_cancelled", {
        eventId: `evt_cancel_${sessionId}`,
        eventType: "checkout.cancelled"
      });
    }

    res.type("html").send("<!doctype html><html><body><p>Payment was cancelled. Reopen the extension to continue.</p></body></html>");
  });

  app.get("/checkout/success", (req, res) => {
    res.type("html").send("<!doctype html><html><body><p>Payment finished. Reopen the extension to sync premium access.</p></body></html>");
  });

  return app;
}

module.exports = {
  createApp,
  createAppContext,
  createResolveResponse
};
