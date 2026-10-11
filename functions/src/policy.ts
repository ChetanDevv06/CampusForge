/**
 * Verification policy: the authoritative state machine, transition rules,
 * retry/appeal limits and derived UI hints.
 *
 * Everything in this module is pure so it can be unit-tested without Firebase.
 * Only the trusted backend may apply these transitions.
 */

import {
  MembershipState,
  VERIFICATION_STATES,
  VerificationNextAction,
  VerificationOutcome,
  VerificationState,
} from "./types";

// ─── Policy constants ────────────────────────────────────────────────────────

export const VERIFICATION_POLICY_VERSION = "v1";

/** How long a provider attempt may stay open before we expire it. */
export const ATTEMPT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** How long a queued/review attempt may wait for a human decision. */
export const REVIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** How long an activated membership lasts before it must be re-verified. */
export const MEMBERSHIP_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 12 months
/** Minimum spacing between verification attempts. */
export const RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Hard cap on attempts per (user, college). Appeals do not consume this. */
export const MAX_ATTEMPTS = 5;
/** Hard cap on appeals per (user, college). */
export const MAX_APPEALS = 2;

// ─── Transitions ─────────────────────────────────────────────────────────────

const TRANSITIONS: Record<VerificationState, readonly VerificationState[]> = {
  not_started: ["pending", "cancelled"],
  pending: [
    "verified",
    "rejected",
    "needs_action",
    "expired",
    "cancelled",
    "suspended",
  ],
  needs_action: [
    "pending",
    "verified",
    "rejected",
    "expired",
    "cancelled",
    "suspended",
  ],
  verified: ["suspended", "expired"],
  rejected: ["pending", "expired"],
  expired: ["pending"],
  suspended: ["pending", "expired"],
  cancelled: ["pending"],
};

export function canTransition(
  from: VerificationState,
  to: VerificationState,
): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

export function isVerificationState(value: unknown): value is VerificationState {
  return (
    typeof value === "string" &&
    (VERIFICATION_STATES as readonly string[]).includes(value)
  );
}

/** Reasons a backend transition may be rejected. */
export type TransitionBlock =
  | "unknown_from"
  | "unknown_to"
  | "illegal_edge"
  | "retry_limit"
  | "cooldown";

export interface TransitionDecision {
  ok: boolean;
  block?: TransitionBlock;
  message?: string;
}

export function assertTransition(
  from: VerificationState | null,
  to: VerificationState,
): TransitionDecision {
  if (from === null) {
    return to === "pending" || to === "cancelled"
      ? { ok: true }
      : {
          ok: false,
          block: "unknown_from",
          message: `Cannot create an attempt directly in state "${to}"`,
        };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      block: "illegal_edge",
      message: `Transition ${from} -> ${to} is not permitted`,
    };
  }
  return { ok: true };
}

// ─── Retry / appeal policy ───────────────────────────────────────────────────

export interface RetryDecision {
  ok: boolean;
  block?: "retry_limit" | "cooldown";
  message?: string;
  /** Attempt number the retry would produce. */
  nextAttemptCount: number;
}

export function evaluateRetry(input: {
  status: VerificationState;
  attemptCount: number;
  updatedAt?: Date | null;
  now?: Date;
}): RetryDecision {
  const now = input.now ?? new Date();
  const nextAttemptCount = input.attemptCount + 1;

  if (input.status === "verified") {
    return {
      ok: false,
      block: "retry_limit",
      message: "Already verified for this college",
      nextAttemptCount,
    };
  }
  if (input.attemptCount >= MAX_ATTEMPTS) {
    return {
      ok: false,
      block: "retry_limit",
      message: `Verification attempt limit reached (${MAX_ATTEMPTS}). Please appeal instead.`,
      nextAttemptCount,
    };
  }
  const last = input.updatedAt ? new Date(input.updatedAt).getTime() : 0;
  if (input.attemptCount > 0 && now.getTime() - last < RETRY_COOLDOWN_MS) {
    return {
      ok: false,
      block: "cooldown",
      message: "Please wait 24 hours before starting another verification attempt.",
      nextAttemptCount,
    };
  }
  return { ok: true, nextAttemptCount };
}

export function evaluateAppeal(input: {
  status: VerificationState;
  attemptCount: number;
  appealCount: number;
}): { ok: boolean; block?: "appeal_limit" | "illegal_edge"; message?: string } {
  if (input.status !== "rejected" && input.status !== "needs_action") {
    return {
      ok: false,
      block: "illegal_edge",
      message: "Only a rejected or evidence-requested verification can be appealed",
    };
  }
  if (input.appealCount >= MAX_APPEALS) {
    return {
      ok: false,
      block: "appeal_limit",
      message: "You have already used all available appeals for this college.",
    };
  }
  return { ok: true };
}

// ─── Outcome handling ────────────────────────────────────────────────────────

export function outcomeToState(outcome: VerificationOutcome): VerificationState {
  switch (outcome) {
    case "approved":
      return "verified";
    case "rejected":
      return "rejected";
    case "inconclusive":
    case "needs_action":
    default:
      // Fail-closed: anything unrecognised becomes needs_action, never verified.
      return "needs_action";
  }
}

/**
 * Membership action implied by a verification status.
 * Membership is only ever activated after an `approved` outcome validated
 * server-side. A client can never trigger `activate`.
 */
export type MembershipAction = "none" | "activate" | "suspend" | "revoke" | "expire";

export function membershipActionFor(
  status: VerificationState,
  current: MembershipState | null,
): MembershipAction {
  switch (status) {
    case "verified":
      return current === "active" ? "none" : "activate";
    case "suspended":
      return current === "suspended" ? "none" : "suspend";
    case "expired":
      return current === "expired" ? "none" : "expire";
    case "rejected":
    case "cancelled":
      return current === "revoked" ? "none" : "revoke";
    case "needs_action":
    case "pending":
    case "not_started":
    default:
      // No membership change: the user simply has not been approved yet.
      return "none";
  }
}

// ─── Expiry ──────────────────────────────────────────────────────────────────

export function computeAttemptExpiry(
  status: VerificationState,
  now: Date,
): Date | null {
  if (status === "pending" || status === "needs_action") {
    return new Date(now.getTime() + REVIEW_TTL_MS);
  }
  return null;
}

// ─── Derived UI hints (non-authoritative) ────────────────────────────────────

export function deriveHints(input: {
  status: VerificationState;
  canRetry: boolean;
  canAppeal: boolean;
  providerConfigured: boolean;
}): { canRetry: boolean; canAppeal: boolean; nextAction: VerificationNextAction } {
  const { status, canRetry, canAppeal, providerConfigured } = input;

  const nextAction = ((): VerificationNextAction => {
    switch (status) {
      case "not_started":
        return "start_verification";
      case "pending":
        return providerConfigured ? "complete_provider_flow" : "await_review";
      case "needs_action":
        return "provide_more_evidence";
      case "verified":
        return "none";
      case "rejected":
        return canAppeal ? "submit_appeal" : canRetry ? "retry" : "contact_support";
      case "expired":
        return "retry";
      case "suspended":
      case "cancelled":
        return "contact_support";
      default:
        return "contact_support";
    }
  })();

  // Defence in depth: an appeal is never offered outside a rejected or
  // evidence-requested state, and a verified student is never offered a retry.
  const appealAllowed = status === "rejected" || status === "needs_action";
  return {
    canRetry: status === "verified" ? false : canRetry,
    canAppeal: appealAllowed ? canAppeal : false,
    nextAction,
  };
}
