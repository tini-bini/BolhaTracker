const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function createStore(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id TEXT PRIMARY KEY,
      install_code TEXT NOT NULL,
      provider TEXT NOT NULL,
      requested_plan TEXT NOT NULL,
      status TEXT NOT NULL,
      customer_email TEXT,
      restore_code TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      checkout_url TEXT NOT NULL,
      cancel_url TEXT,
      failure_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      session_id TEXT,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entitlement_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      install_code TEXT NOT NULL,
      claim_source TEXT NOT NULL,
      claimed_at INTEGER NOT NULL,
      UNIQUE(session_id, install_code)
    );
  `);

  const statements = {
    insertCheckout: db.prepare(`
      INSERT INTO checkout_sessions (
        id, install_code, provider, requested_plan, status, customer_email, restore_code,
        created_at, updated_at, completed_at, checkout_url, cancel_url, failure_reason
      ) VALUES (
        @id, @installCode, @provider, @requestedPlan, @status, @customerEmail, @restoreCode,
        @createdAt, @updatedAt, @completedAt, @checkoutUrl, @cancelUrl, @failureReason
      )
      ON CONFLICT(id) DO UPDATE SET
        install_code = excluded.install_code,
        provider = excluded.provider,
        requested_plan = excluded.requested_plan,
        status = excluded.status,
        customer_email = excluded.customer_email,
        restore_code = excluded.restore_code,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        checkout_url = excluded.checkout_url,
        cancel_url = excluded.cancel_url,
        failure_reason = excluded.failure_reason
    `),
    getCheckoutById: db.prepare(`SELECT * FROM checkout_sessions WHERE id = ?`),
    getLatestCheckoutForInstall: db.prepare(`
      SELECT * FROM checkout_sessions
      WHERE install_code = ?
      ORDER BY created_at DESC
      LIMIT 1
    `),
    getOpenCheckoutForInstall: db.prepare(`
      SELECT * FROM checkout_sessions
      WHERE install_code = ?
        AND status = 'checkout_pending'
      ORDER BY created_at DESC
      LIMIT 1
    `),
    listClaimsForSession: db.prepare(`
      SELECT install_code, claim_source, claimed_at
      FROM entitlement_claims
      WHERE session_id = ?
      ORDER BY claimed_at ASC
    `),
    getActiveSessionForInstall: db.prepare(`
      SELECT c.*
      FROM checkout_sessions c
      LEFT JOIN entitlement_claims e ON e.session_id = c.id
      WHERE c.status = 'premium_active'
        AND (c.install_code = ? OR e.install_code = ?)
      ORDER BY c.completed_at DESC, c.updated_at DESC
      LIMIT 1
    `),
    getPaidSessionForRestore: db.prepare(`
      SELECT *
      FROM checkout_sessions
      WHERE status = 'premium_active'
        AND lower(customer_email) = lower(?)
        AND restore_code = ?
      ORDER BY completed_at DESC, updated_at DESC
      LIMIT 1
    `),
    insertWebhookEvent: db.prepare(`
      INSERT INTO webhook_events (id, event_type, session_id, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertClaim: db.prepare(`
      INSERT INTO entitlement_claims (session_id, install_code, claim_source, claimed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, install_code) DO UPDATE SET
        claim_source = excluded.claim_source,
        claimed_at = excluded.claimed_at
    `)
  };

  function serializeCheckout(row) {
    return row
      ? {
          id: row.id,
          installCode: row.install_code,
          provider: row.provider,
          requestedPlan: row.requested_plan,
          status: row.status,
          customerEmail: row.customer_email || null,
          restoreCode: row.restore_code || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at || null,
          checkoutUrl: row.checkout_url,
          cancelUrl: row.cancel_url || null,
          failureReason: row.failure_reason || null
        }
      : null;
  }

  return {
    db,
    upsertCheckout(record) {
      statements.insertCheckout.run({
        id: record.id,
        installCode: record.installCode,
        provider: record.provider,
        requestedPlan: record.requestedPlan,
        status: record.status,
        customerEmail: record.customerEmail || null,
        restoreCode: record.restoreCode || null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        completedAt: record.completedAt || null,
        checkoutUrl: record.checkoutUrl,
        cancelUrl: record.cancelUrl || null,
        failureReason: record.failureReason || null
      });
      return this.getCheckoutById(record.id);
    },
    getCheckoutById(id) {
      return serializeCheckout(statements.getCheckoutById.get(id));
    },
    getLatestCheckoutForInstall(installCode) {
      return serializeCheckout(statements.getLatestCheckoutForInstall.get(installCode));
    },
    getOpenCheckoutForInstall(installCode) {
      return serializeCheckout(statements.getOpenCheckoutForInstall.get(installCode));
    },
    getActiveSessionForInstall(installCode) {
      return serializeCheckout(statements.getActiveSessionForInstall.get(installCode, installCode));
    },
    getPaidSessionForRestore(email, restoreCode) {
      return serializeCheckout(statements.getPaidSessionForRestore.get(String(email || ""), String(restoreCode || "").trim().toUpperCase()));
    },
    recordWebhookEvent(eventId, eventType, sessionId, payloadJson, createdAt) {
      try {
        statements.insertWebhookEvent.run(eventId, eventType, sessionId || null, payloadJson, createdAt);
        return true;
      } catch (error) {
        if (String(error && error.message).includes("UNIQUE")) {
          return false;
        }

        throw error;
      }
    },
    listClaimsForSession(sessionId) {
      return statements.listClaimsForSession.all(sessionId).map((row) => ({
        installCode: row.install_code,
        claimSource: row.claim_source,
        claimedAt: row.claimed_at
      }));
    },
    upsertClaim(sessionId, installCode, claimSource) {
      const claimedAt = Date.now();
      statements.insertClaim.run(sessionId, installCode, claimSource, claimedAt);
      return { sessionId, installCode, claimSource, claimedAt };
    },
    close() {
      db.close();
    }
  };
}

module.exports = {
  createStore
};
