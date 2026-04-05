const path = require("node:path");
const { URL } = require("node:url");

const DEFAULT_DEV_PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgS64Zy62dv9+HaPCY",
  "DvISgKKA3L8g9z2VGNDaf0cuJGqhRANCAAQ0o9H2sVYrs7yx/X82AN00oIW1kixr",
  "6zodX1xQy+M7LQrfqP47s0CgVdS3iX1Yl/exxyZ21Cq+39HGa6HgBwbs",
  "-----END PRIVATE KEY-----"
].join("\n");

const DEFAULT_DEV_PUBLIC_KEY = [
  "-----BEGIN PUBLIC KEY-----",
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENKPR9rFWK7O8sf1/NgDdNKCFtZIs",
  "a+s6HV9cUMvjOy0K36j+O7NAoFXUt4l9WJf3sccmdtQqvt/Rxmuh4AcG7A==",
  "-----END PUBLIC KEY-----"
].join("\n");

function getBooleanEnv(name, fallback = false) {
  const raw = process.env[name];

  if (raw == null || raw === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch (error) {
    return false;
  }
}

function loadConfig(rootDir) {
  const dataDir = path.join(rootDir, "server", "data");
  const paymentProvider = process.env.BOLHA_PAYMENT_PROVIDER || "mock";
  const allowDevSigning = paymentProvider === "mock" || getBooleanEnv("BOLHA_ALLOW_DEV_SIGNING", false);
  const baseUrl = process.env.BOLHA_SERVER_BASE_URL || "http://127.0.0.1:8787";
  const signingKeyId = process.env.BOLHA_SIGNING_KEY_ID || "dev-local-v1";
  const privateKeyPem = process.env.BOLHA_SIGNING_PRIVATE_KEY_PEM || (allowDevSigning ? DEFAULT_DEV_PRIVATE_KEY : "");
  const publicKeyPem = process.env.BOLHA_SIGNING_PUBLIC_KEY_PEM || DEFAULT_DEV_PUBLIC_KEY;

  const config = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || "8787"),
    baseUrl,
    dataDir,
    dbPath: process.env.BOLHA_DB_PATH || path.join(dataDir, "entitlements.sqlite"),
    paymentProvider,
    allowDevSigning,
    signingKeyId,
    signingPrivateKeyPem: privateKeyPem,
    signingPublicKeyPem: publicKeyPem,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    stripePriceId: process.env.STRIPE_PRICE_ID || "",
    maxInstallClaims: Math.max(1, Number(process.env.BOLHA_MAX_INSTALL_CLAIMS || "3")),
    entitlementTtlMs: Math.max(60000, Number(process.env.BOLHA_ENTITLEMENT_TTL_MS || String(1000 * 60 * 60 * 24 * 7)))
  };

  if (config.env === "production") {
    if (!isHttpsUrl(config.baseUrl)) {
      throw new Error("Production backend requires an HTTPS BOLHA_SERVER_BASE_URL.");
    }

    if (!config.signingPrivateKeyPem || config.signingPrivateKeyPem === DEFAULT_DEV_PRIVATE_KEY) {
      throw new Error("Production backend cannot use the bundled development signing key.");
    }
  }

  return config;
}

module.exports = {
  DEFAULT_DEV_PUBLIC_KEY,
  loadConfig
};
