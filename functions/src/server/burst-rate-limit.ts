/**
 * Burst rate limiting for the HTTP transport.
 *
 * The authoritative limits live in `rate-limit.ts` and are backed by Firestore,
 * so they are keyed by account id and survive restarts and horizontal
 * scale-out. This module adds a second, deliberately coarse ceiling in front of
 * them:
 *
 *  - a flood is rejected in-process, before the Firestore round-trip that the
 *    authoritative limiter would otherwise pay for on every request;
 *  - it uses the standard `express-rate-limit` middleware, which is what
 *    CodeQL's js/missing-rate-limiting query models — a custom helper such as
 *    `consumeRateLimit` is invisible to it.
 *
 * The two are complementary: this one stops runaway loops cheaply, the
 * Firestore one enforces the per-operation budgets that must not reset on a
 * restart (5 verification attempts per hour, 3 appeals per day, ...).
 */

import type { IncrementResponse, Options, Store } from "express-rate-limit";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

/**
 * Minimal fixed-window counter using the v8 store interface.
 *
 * A plain map is enough because this guard is intentionally per-process and
 * coarse — the accurate, persistent budgets live in `rate-limit.ts`.
 */
class BurstStore implements Store {
  private hits = new Map<string, { totalHits: number; resetTime: number }>();
  // Supplied by `init`; falls back to a minute if the store is used directly.
  private windowMs = 60 * 1000;

  init(options: Options): void {
    if (typeof options.windowMs === "number") {
      this.windowMs = options.windowMs;
    }
  }

  increment(key: string): IncrementResponse {
    const now = Date.now();
    const current = this.hits.get(key);
    const resetTime =
      current && current.resetTime > now ? current.resetTime : now + this.windowMs;
    const totalHits =
      current && current.resetTime > now ? current.totalHits + 1 : 1;
    this.hits.set(key, { totalHits, resetTime });
    return { totalHits, resetTime: new Date(resetTime) };
  }

  decrement(key: string): void {
    const current = this.hits.get(key);
    if (!current) return;
    if (current.totalHits <= 1) this.hits.delete(key);
    else this.hits.set(key, { ...current, totalHits: current.totalHits - 1 });
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }
}

const RATE_LIMITED_MESSAGE = {
  error: {
    message: "Too many requests. Please try again later.",
    status: "resource-exhausted",
    details: { verificationCode: "VERIFICATION_RATE_LIMITED" },
  },
};

/**
 * Per-account burst ceiling for every authenticated verification route.
 *
 * Keyed by account id rather than IP: a campus NAT or a shared hostel network
 * would otherwise put an entire building behind one counter, so one busy
 * student could throttle everyone else.
 */
export const authenticateBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Far above any per-operation budget (the strictest is 5 attempts/hour), so
  // normal use is never affected; this only stops a runaway loop.
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new BurstStore(),
  keyGenerator: (req) =>
    // `req.auth` is populated by the `authenticate` middleware, which always
    // runs before this limiter.
    (req as { auth?: { uid: string } }).auth?.uid
      ? `uid:${(req as { auth?: { uid: string } }).auth!.uid}`
      : ipKeyGenerator(req.ip ?? ""),
  message: RATE_LIMITED_MESSAGE,
  statusCode: 429,
});

/**
 * Per-IP ceiling for the unauthenticated provider webhook. Providers send from
 * a small set of addresses, and the authoritative per-reference limit lives in
 * `handleProviderWebhook`.
 */
export const callbackBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new BurstStore(),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: RATE_LIMITED_MESSAGE,
  statusCode: 429,
  // Never fail a legitimate provider callback because of validation options.
  skip: (req) => req.method !== "POST",
});

export type { Options, Store };
