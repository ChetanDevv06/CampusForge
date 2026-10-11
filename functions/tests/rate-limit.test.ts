/**
 * Rate limiter tests against the Firestore emulator.
 *
 * Run with the emulator (or via `npm --prefix functions run test:emulator`).
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as admin from "firebase-admin";
import {
  RATE_LIMITS,
  RateLimitError,
  consumeRateLimit,
  type RateLimitScope,
} from "../src/rate-limit";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfEmulator = EMULATOR_HOST ? describe : describe.skip;

let db: admin.firestore.Firestore;

function subject(label: string): string {
  return `test-user:${label}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

describeIfEmulator("consumeRateLimit", () => {
  beforeAll(() => {
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: "demo-campusforge" });
    }
    db = admin.firestore();
  });

  beforeEach(async () => {
    await db
      .collection("rate_limits")
      .get()
      .then(async (snap) => {
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      });
  });

  it("allows requests up to the configured maximum, then throws", async () => {
    const scope: RateLimitScope = "submitAppeal"; // max 3 / day
    const key = subject("budget");

    await consumeRateLimit(scope, key, db);
    await consumeRateLimit(scope, key, db);
    await consumeRateLimit(scope, key, db);

    await expect(consumeRateLimit(scope, key, db)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });

  it("reports a positive retry delay", async () => {
    const scope: RateLimitScope = "submitAppeal";
    const key = subject("retry-after");

    for (let i = 0; i < RATE_LIMITS[scope].max; i += 1) {
      await consumeRateLimit(scope, key, db);
    }

    const error = await consumeRateLimit(scope, key, db).catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBeGreaterThan(0);
    expect((error as RateLimitError).retryAfterMs).toBeLessThanOrEqual(
      RATE_LIMITS[scope].windowMs,
    );
  });

  it("keeps separate subjects in separate windows", async () => {
    const scope: RateLimitScope = "submitAppeal";
    const first = subject("a");
    const second = subject("b");

    for (let i = 0; i < RATE_LIMITS[scope].max; i += 1) {
      await consumeRateLimit(scope, first, db);
    }
    await expect(consumeRateLimit(scope, first, db)).rejects.toBeInstanceOf(
      RateLimitError,
    );

    // A different account is unaffected.
    await expect(consumeRateLimit(scope, second, db)).resolves.toBeUndefined();
  });

  it("uses one window per scope, so scopes do not share a budget", async () => {
    const key = subject("shared");
    const appeal: RateLimitScope = "submitAppeal"; // max 3 / day
    const cancel: RateLimitScope = "cancelVerification"; // max 20 / min

    for (let i = 0; i < RATE_LIMITS[appeal].max; i += 1) {
      await consumeRateLimit(appeal, key, db);
    }
    await expect(consumeRateLimit(appeal, key, db)).rejects.toBeInstanceOf(
      RateLimitError,
    );

    await expect(consumeRateLimit(cancel, key, db)).resolves.toBeUndefined();
  });

  it("refuses to limit nothing: an unknown scope must not silently pass", async () => {
    // Guards the bug where a misspelled scope silently disabled the limiter:
    // a known scope still enforces its budget, an unknown one throws.
    const key = subject("x");
    for (let i = 0; i < RATE_LIMITS.getVerificationStatus.max; i += 1) {
      await consumeRateLimit("getVerificationStatus", key, db);
    }
    await expect(
      consumeRateLimit("getVerificationStatus", key, db),
    ).rejects.toBeInstanceOf(RateLimitError);

    await expect(
      consumeRateLimit("notARealScope" as RateLimitScope, subject("y"), db),
    ).rejects.toThrow(/Unknown rate-limit scope/);
  });
});
