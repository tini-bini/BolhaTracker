const crypto = require("node:crypto");

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function randomRestoreCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function maskEmail(email) {
  const raw = String(email || "").trim().toLowerCase();

  if (!raw || !raw.includes("@")) {
    return null;
  }

  const [local, domain] = raw.split("@");
  const safeLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

function createPaymentService(config, store) {
  async function createMockCheckoutSession({ installCode, requestedPlan }) {
    const id = randomId("cs_mock");
    const createdAt = Date.now();
    const checkoutUrl = `${config.baseUrl}/mock/checkout/${id}`;
    const cancelUrl = `${config.baseUrl}/mock/cancel/${id}`;

    return store.upsertCheckout({
      id,
      installCode,
      provider: "mock",
      requestedPlan,
      status: "checkout_pending",
      customerEmail: null,
      restoreCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      checkoutUrl,
      cancelUrl,
      failureReason: null
    });
  }

  async function createStripeCheckoutSession({ installCode, requestedPlan }) {
    const Stripe = require("stripe");

    if (!config.stripeSecretKey || !config.stripePriceId) {
      throw new Error("Stripe konfiguracija manjka.");
    }

    const stripe = new Stripe(config.stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: config.stripePriceId,
          quantity: 1
        }
      ],
      success_url: `${config.baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.baseUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_creation: "always",
      metadata: {
        installCode,
        requestedPlan
      }
    });

    return store.upsertCheckout({
      id: session.id,
      installCode,
      provider: "stripe",
      requestedPlan,
      status: "checkout_pending",
      customerEmail: null,
      restoreCode: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      checkoutUrl: session.url,
      cancelUrl: `${config.baseUrl}/checkout/cancel?session_id=${session.id}`,
      failureReason: null
    });
  }

  async function createCheckoutSession(args) {
    const existingPending = store.getOpenCheckoutForInstall(args.installCode);

    if (existingPending && existingPending.checkoutUrl) {
      return existingPending;
    }

    if (config.paymentProvider === "stripe") {
      return createStripeCheckoutSession(args);
    }

    return createMockCheckoutSession(args);
  }

  function transitionSession(sessionId, nextStatus, details = {}) {
    const current = store.getCheckoutById(sessionId);

    if (!current) {
      throw new Error("Checkout seje ni bilo mogoče najti.");
    }

    if (details.eventId) {
      const inserted = store.recordWebhookEvent(
        details.eventId,
        details.eventType || nextStatus,
        sessionId,
        JSON.stringify({
          ...details,
          nextStatus
        }),
        details.createdAt || Date.now()
      );

      if (!inserted) {
        return current;
      }
    }

    const customerEmail = details.customerEmail || current.customerEmail;
    const restoreCode = nextStatus === "premium_active"
      ? (current.restoreCode || details.restoreCode || randomRestoreCode())
      : current.restoreCode;
    const completedAt = nextStatus === "premium_active" ? (current.completedAt || Date.now()) : current.completedAt;

    return store.upsertCheckout({
      ...current,
      status: nextStatus,
      customerEmail,
      restoreCode,
      updatedAt: Date.now(),
      completedAt,
      failureReason: details.failureReason || null
    });
  }

  async function handleStripeWebhook(signature, rawBody) {
    const Stripe = require("stripe");

    if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
      throw new Error("Stripe webhook konfiguracija manjka.");
    }

    const stripe = new Stripe(config.stripeSecretKey);
    const event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
    const object = event.data && event.data.object ? event.data.object : {};
    const sessionId = object.id || (object.metadata && object.metadata.checkoutSessionId) || null;

    if (event.type === "checkout.session.completed") {
      return transitionSession(sessionId, "premium_active", {
        eventId: event.id,
        eventType: event.type,
        customerEmail: object.customer_details && object.customer_details.email,
        createdAt: event.created ? event.created * 1000 : Date.now()
      });
    }

    if (event.type === "checkout.session.expired") {
      return transitionSession(sessionId, "payment_cancelled", {
        eventId: event.id,
        eventType: event.type,
        createdAt: event.created ? event.created * 1000 : Date.now()
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      return transitionSession(sessionId, "payment_failed", {
        eventId: event.id,
        eventType: event.type,
        createdAt: event.created ? event.created * 1000 : Date.now(),
        failureReason: object.last_payment_error && object.last_payment_error.message
      });
    }

    return null;
  }

  function ensureRestoreAllowed(session, installCode) {
    const claims = store.listClaimsForSession(session.id);
    const uniqueInstalls = new Set([session.installCode, ...claims.map((claim) => claim.installCode)]);

    if (uniqueInstalls.has(installCode)) {
      return true;
    }

    return uniqueInstalls.size < config.maxInstallClaims;
  }

  function claimSessionForInstall(session, installCode, claimSource) {
    if (!ensureRestoreAllowed(session, installCode)) {
      throw new Error("Doseženo je največje število naprav za to licenco.");
    }

    store.upsertClaim(session.id, installCode, claimSource);
    return store.getCheckoutById(session.id);
  }

  function getResolveState(installCode) {
    const active = store.getActiveSessionForInstall(installCode);

    if (active) {
      return {
        status: "premium_active",
        session: active,
        maskedEmail: maskEmail(active.customerEmail)
      };
    }

    const latest = store.getLatestCheckoutForInstall(installCode);

    if (!latest) {
      return {
        status: "free",
        session: null,
        maskedEmail: null
      };
    }

    return {
      status: latest.status,
      session: latest,
      maskedEmail: maskEmail(latest.customerEmail)
    };
  }

  return {
    createCheckoutSession,
    handleStripeWebhook,
    transitionSession,
    claimSessionForInstall,
    getResolveState
  };
}

module.exports = {
  createPaymentService,
  maskEmail
};
