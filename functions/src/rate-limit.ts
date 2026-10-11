/**
 * Rate limiting for verification endpoints.
 *
 * Uses Firestore counters (collection `rate_limits`) with fixed windows. This is
 * intentionally simple and conservative — it exists to blunt brute-force and
 * automated abuse, not to be a complete anti-fraud system.
 */

import * as admin from "firebase-admin";
import { PATHS, getDb } from "./db";

export interface RateLimitRule {
  /** Maximum number of events allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * `as const` matters here: it makes the scope a union of literal keys, so
 * calling `consumeRateLimit` with a misspelled scope is a compile error rather
 * than a silent no-op that quietly disables a limit.
 */
export const RATE_LIMITS = {
  startVerification: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour
  retryVerification: { max: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 / day
  submitAppeal: { max: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 / day
  providerCallback: { max: 600, windowMs: 60 * 1000 }, // 600 / min per provider ref
  // Read-mostly and low-impact routes: generous ceilings that stop floods
  // without affecting normal use.
  getVerificationStatus: { max: 120, windowMs: 60 * 1000 }, // 120 / min
  cancelVerification: { max: 20, windowMs: 60 * 1000 }, // 20 / min
  // Administrative routes.
  adjudicateVerification: { max: 60, windowMs: 60 * 1000 }, // 60 / min
  revokeMembership: { max: 60, windowMs: 60 * 1000 }, // 60 / min
  verifyExpire: { max: 5, windowMs: 60 * 1000 }, // 5 / min
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export class RateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitError";
  }
}

/**
 * Consume one token from the windowed counter `scope:subject`.
 * Throws RateLimitError when the window budget is exhausted.
 *
 * An unknown scope throws rather than passing: a limiter that silently stops
 * limiting is worse than no limiter at all.
 */
export async function consumeRateLimit(
  scope: RateLimitScope,
  subject: string,
  db = getDb(),
): Promise<void> {
  const rule = RATE_LIMITS[scope];
  if (!rule) {
    throw new Error(`Unknown rate-limit scope: ${String(scope)}`);
  }

  const ref = db.doc(PATHS.rateLimit(`${scope}:${subject}`));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const windowStart = (data.windowStart as admin.firestore.Timestamp | undefined);
    const now = Date.now();

    const startMs = windowStart ? windowStart.toMillis() : 0;
    const isNewWindow = !startMs || now - startMs >= rule.windowMs;

    const count = isNewWindow ? 1 : Number(data.count ?? 0) + 1;

    if (!isNewWindow && count > rule.max) {
      throw new RateLimitError(startMs + rule.windowMs - now);
    }

    tx.set(
      ref,
      {
        count,
        windowStart: admin.firestore.Timestamp.fromMillis(
          isNewWindow ? now : startMs,
        ),
        expiresAt: admin.firestore.Timestamp.fromMillis(
          (isNewWindow ? now : startMs) + rule.windowMs,
        ),
      },
      { merge: true },
    );
  });
}
