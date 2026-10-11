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

export const RATE_LIMITS: Record<string, RateLimitRule> = {
  startVerification: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour
  retryVerification: { max: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 / day
  submitAppeal: { max: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 / day
  providerCallback: { max: 600, windowMs: 60 * 1000 }, // 600 / min per provider ref
};

export class RateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitError";
  }
}

/**
 * Consume one token from the windowed counter `scope:subject`.
 * Throws RateLimitError when the window budget is exhausted.
 */
export async function consumeRateLimit(
  scope: keyof typeof RATE_LIMITS,
  subject: string,
  db = getDb(),
): Promise<void> {
  const rule = RATE_LIMITS[scope];
  if (!rule) return;

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
