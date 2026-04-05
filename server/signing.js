const crypto = require("node:crypto");

function maskEmail(email) {
  const raw = String(email || "").trim().toLowerCase();

  if (!raw || !raw.includes("@")) {
    return null;
  }

  const [local, domain] = raw.split("@");
  const safeLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

function signPayload(payloadJson, keyId, privateKeyPem) {
  const signer = crypto.createSign("SHA256");
  signer.update(payloadJson);
  signer.end();

  return {
    keyId,
    payload: payloadJson,
    signature: signer.sign(privateKeyPem, "base64")
  };
}

function verifyPayload(envelope, publicKeyPem) {
  const verifier = crypto.createVerify("SHA256");
  verifier.update(envelope.payload);
  verifier.end();
  return verifier.verify(publicKeyPem, envelope.signature, "base64");
}

function createEntitlementPayload(session, installCode, ttlMs) {
  const now = Date.now();
  return {
    entitlementId: session.id,
    installCode,
    plan: "premium_lifetime",
    status: "premium_active",
    issuedAt: now,
    expiresAt: now + ttlMs,
    checkoutSessionId: session.id,
    maskedEmail: maskEmail(session.customerEmail),
    restoreCode: session.restoreCode || null
  };
}

function createSignedEntitlementEnvelope(session, installCode, config) {
  const payload = createEntitlementPayload(session, installCode, config.entitlementTtlMs);
  const payloadJson = JSON.stringify(payload);
  return signPayload(payloadJson, config.signingKeyId, config.signingPrivateKeyPem);
}

module.exports = {
  createSignedEntitlementEnvelope,
  verifyPayload
};
