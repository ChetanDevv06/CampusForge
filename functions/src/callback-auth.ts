/**
 * Provider callback authentication helpers (pure, unit-testable).
 *
 * Provider webhook mechanisms differ. Two common ones are supported here:
 *  1. HMAC-SHA256 signature header (`x-campusforge-signature`), as used by
 *     Stripe-style webhook signing.
 *  2. A shared bearer token in the Authorization header.
 *
 * A callback is accepted only if at least one mechanism configured for the
 * provider validates. Unknown/absent configuration means the callback is
 * rejected — never trusted.
 */

import { createHmac, timingSafeEqual } from "crypto";

export type CallbackAuthMode = "hmac" | "bearer" | "none";

export interface CallbackAuthConfig {
  mode: CallbackAuthMode;
  /** HMAC signing secret (server-side only). */
  webhookSecret?: string;
  /** Shared bearer token (server-side only). */
  bearerToken?: string;
  /** Tolerance in seconds for signed timestamps. */
  toleranceSeconds?: number;
}

export interface CallbackAuthInput {
  config: CallbackAuthConfig | null;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  /** Current time in seconds (injectable for tests). */
  nowSeconds?: number;
}

export interface CallbackAuthResult {
  ok: boolean;
  reason?: string;
  /** Value signed timestamp extracted from the payload/header, if any. */
  timestampSeconds?: number;
}

const SIGNATURE_HEADER = "x-campusforge-signature";
const TIMESTAMP_HEADER = "x-campusforge-timestamp";

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

function extractSignedTimestamp(rawBody: string): number | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const candidates = [parsed.timestamp, parsed.eventTime, parsed.created];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate > 1e12 ? Math.floor(candidate / 1000) : candidate;
      }
      if (typeof candidate === "string" && /^\d{10,13}$/.test(candidate)) {
        const numeric = Number(candidate);
        return numeric > 1e12 ? Math.floor(numeric / 1000) : numeric;
      }
    }
  } catch {
    // Not JSON or no timestamp — fall through to header-based validation.
  }
  return null;
}

export function verifyCallbackAuth(input: CallbackAuthInput): CallbackAuthResult {
  const { config, rawBody, headers } = input;
  if (!config || config.mode === "none") {
    return { ok: false, reason: "callback_authentication_not_configured" };
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (config.mode === "bearer") {
    const authorization = headerValue(headers, "authorization");
    if (!authorization || !config.bearerToken) {
      return { ok: false, reason: "missing_bearer_token" };
    }
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!safeEqualHex(token, config.bearerToken)) {
      return { ok: false, reason: "invalid_bearer_token" };
    }
    return { ok: true };
  }

  // HMAC mode.
  const signature = headerValue(headers, SIGNATURE_HEADER);
  if (!signature || !config.webhookSecret) {
    return { ok: false, reason: "missing_signature" };
  }

  const headerTimestamp = headerValue(headers, TIMESTAMP_HEADER);
  const timestamp = headerTimestamp
    ? Number(headerTimestamp)
    : extractSignedTimestamp(rawBody);

  const tolerance = config.toleranceSeconds ?? 300;
  if (timestamp && Number.isFinite(timestamp)) {
    if (Math.abs(now - timestamp) > tolerance) {
      return { ok: false, reason: "stale_signature", timestampSeconds: timestamp };
    }
  }

  const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const expected = createHmac("sha256", config.webhookSecret)
    .update(payload, "utf8")
    .digest("hex");

  const provided = signature.replace(/^sha256=/i, "");
  if (!safeEqualHex(expected, provided)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, timestampSeconds: timestamp ?? undefined };
}
