const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { createApp, createAppContext } = require("../server/app.js");

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

async function createTestServer(t) {
  const port = await getAvailablePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bolha-server-test-"));
  const dbPath = path.join(tempDir, "entitlements.sqlite");
  const context = createAppContext({
    rootDir: process.cwd(),
    config: {
      paymentProvider: "mock",
      baseUrl: `http://127.0.0.1:${port}`,
      dbPath
    }
  });
  const app = createApp({ context });
  const server = await new Promise((resolve) => {
    const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
  });

  t.after(() => {
    context.store.close();
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    context
  };
}

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body || {})
  });
  const payload = await response.json();
  return {
    status: response.status,
    ok: response.ok,
    payload
  };
}

test("checkout sessions are idempotent per install until payment completes", async (t) => {
  const server = await createTestServer(t);
  const installCode = "bolha-install-a";

  const first = await postJson(server.baseUrl, "/api/checkout/session", {
    installCode,
    plan: "premium_lifetime"
  });
  const second = await postJson(server.baseUrl, "/api/checkout/session", {
    installCode,
    plan: "premium_lifetime"
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.payload.checkoutSessionId, second.payload.checkoutSessionId);
  assert.match(first.payload.checkoutUrl, /\/mock\/checkout\//);
});

test("successful mock checkout resolves to active premium and emits restore metadata", async (t) => {
  const server = await createTestServer(t);
  const installCode = "bolha-install-b";

  const checkout = await postJson(server.baseUrl, "/api/checkout/session", {
    installCode,
    plan: "premium_lifetime"
  });
  assert.equal(checkout.ok, true);

  const sessionId = checkout.payload.checkoutSessionId;
  const completion = await fetch(`${server.baseUrl}/mock/checkout/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "result=success&email=buyer%40example.com",
    redirect: "manual"
  });
  assert.equal(completion.status, 200);

  const resolved = await postJson(server.baseUrl, "/api/entitlements/resolve", {
    installCode
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.payload.status, "premium_active");
  assert.equal(resolved.payload.plan, "premium_lifetime");
  assert.equal(resolved.payload.maskedEmail, "bu***@example.com");
  assert.ok(resolved.payload.restoreCode);
  assert.ok(resolved.payload.envelope);
});

test("restore flow enforces the max install claims limit", async (t) => {
  const server = await createTestServer(t);
  const checkout = await postJson(server.baseUrl, "/api/checkout/session", {
    installCode: "bolha-install-primary",
    plan: "premium_lifetime"
  });
  const sessionId = checkout.payload.checkoutSessionId;

  await fetch(`${server.baseUrl}/mock/checkout/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "result=success&email=buyer%40example.com",
    redirect: "manual"
  });

  const resolvePrimary = await postJson(server.baseUrl, "/api/entitlements/resolve", {
    installCode: "bolha-install-primary"
  });
  const restoreCode = resolvePrimary.payload.restoreCode;

  const second = await postJson(server.baseUrl, "/api/entitlements/restore", {
    installCode: "bolha-install-second",
    email: "buyer@example.com",
    restoreCode
  });
  const third = await postJson(server.baseUrl, "/api/entitlements/restore", {
    installCode: "bolha-install-third",
    email: "buyer@example.com",
    restoreCode
  });
  const fourth = await postJson(server.baseUrl, "/api/entitlements/restore", {
    installCode: "bolha-install-fourth",
    email: "buyer@example.com",
    restoreCode
  });

  assert.equal(second.ok, true);
  assert.equal(third.ok, true);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.status, 409);
  assert.match(fourth.payload.error, /največje število naprav/i);
});

test("webhook-like event transitions are idempotent by event id", async (t) => {
  const server = await createTestServer(t);
  const session = server.context.store.upsertCheckout({
    id: "cs_webhook_1",
    installCode: "bolha-install-webhook",
    provider: "mock",
    requestedPlan: "premium_lifetime",
    status: "checkout_pending",
    customerEmail: null,
    restoreCode: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    checkoutUrl: `${server.baseUrl}/mock/checkout/cs_webhook_1`,
    cancelUrl: `${server.baseUrl}/checkout/cancel?session_id=cs_webhook_1`,
    failureReason: null
  });

  const first = server.context.payments.transitionSession(session.id, "payment_failed", {
    eventId: "evt_duplicate",
    eventType: "payment_intent.payment_failed",
    failureReason: "Card declined"
  });
  const second = server.context.payments.transitionSession(session.id, "premium_active", {
    eventId: "evt_duplicate",
    eventType: "checkout.session.completed",
    customerEmail: "buyer@example.com"
  });

  assert.equal(first.status, "payment_failed");
  assert.equal(second.status, "payment_failed");
  assert.equal(server.context.store.getCheckoutById(session.id).status, "payment_failed");
});
