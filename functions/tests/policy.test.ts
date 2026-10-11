import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  computeAttemptExpiry,
  deriveHints,
  evaluateAppeal,
  evaluateRetry,
  isVerificationState,
  MAX_APPEALS,
  MAX_ATTEMPTS,
  membershipActionFor,
  outcomeToState,
  RETRY_COOLDOWN_MS,
  VERIFICATION_POLICY_VERSION,
} from "../src/policy";
import { redactPayload } from "../src/verification-service";
import { VERIFICATION_STATES } from "../src/types";

describe("verification state machine", () => {
  it("exposes the required states", () => {
    expect([...VERIFICATION_STATES].sort()).toEqual(
      [
        "cancelled",
        "expired",
        "needs_action",
        "not_started",
        "pending",
        "rejected",
        "suspended",
        "verified",
      ].sort(),
    );
  });

  it("recognises only known states", () => {
    expect(isVerificationState("pending")).toBe(true);
    expect(isVerificationState("approved")).toBe(false);
    expect(isVerificationState(undefined)).toBe(false);
  });

  it("allows a fresh attempt to start pending", () => {
    expect(assertTransition(null, "pending").ok).toBe(true);
    expect(assertTransition(null, "verified").ok).toBe(false);
    expect(assertTransition("not_started", "pending").ok).toBe(true);
  });

  it("permits the documented transitions", () => {
    expect(canTransition("pending", "verified")).toBe(true);
    expect(canTransition("pending", "needs_action")).toBe(true);
    expect(canTransition("rejected", "pending")).toBe(true);
    expect(canTransition("expired", "pending")).toBe(true);
    expect(canTransition("suspended", "pending")).toBe(true);
    expect(canTransition("cancelled", "pending")).toBe(true);
  });

  it("forbids bypassing review", () => {
    // not_started must never jump straight to verified.
    expect(canTransition("not_started", "verified")).toBe(false);
    // A pending attempt cannot be skipped to verified by an unknown edge.
    expect(canTransition("needs_action", "not_started")).toBe(false);
    // Re-verification of an already verified college goes through suspend.
    expect(canTransition("verified", "pending")).toBe(false);
  });

  it("keeps rejected and expired out of the granted set", () => {
    expect(canTransition("rejected", "verified")).toBe(false);
    expect(canTransition("expired", "verified")).toBe(false);
  });
});

describe("provider outcome mapping is fail-closed", () => {
  it("maps documented outcomes", () => {
    expect(outcomeToState("approved")).toBe("verified");
    expect(outcomeToState("rejected")).toBe("rejected");
    expect(outcomeToState("needs_action")).toBe("needs_action");
    expect(outcomeToState("inconclusive")).toBe("needs_action");
  });

  it("never verifies on an unknown outcome", () => {
    const unknown = "totally_made_up" as unknown as "approved";
    expect(outcomeToState(unknown)).toBe("needs_action");
    expect(outcomeToState(unknown)).not.toBe("verified");
  });
});

describe("retry policy", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("blocks retry once the attempt cap is reached", () => {
    const decision = evaluateRetry({
      status: "rejected",
      attemptCount: MAX_ATTEMPTS,
      updatedAt: now,
      now: new Date("2026-02-01T00:00:00Z"),
    });
    expect(decision.ok).toBe(false);
    expect(decision.block).toBe("retry_limit");
  });

  it("enforces the cooldown between attempts", () => {
    const decision = evaluateRetry({
      status: "rejected",
      attemptCount: 2,
      updatedAt: now,
      now: new Date(now.getTime() + RETRY_COOLDOWN_MS - 1000),
    });
    expect(decision.ok).toBe(false);
    expect(decision.block).toBe("cooldown");
  });

  it("allows a retry after the cooldown", () => {
    const decision = evaluateRetry({
      status: "rejected",
      attemptCount: 2,
      updatedAt: now,
      now: new Date(now.getTime() + RETRY_COOLDOWN_MS + 1000),
    });
    expect(decision.ok).toBe(true);
    expect(decision.nextAttemptCount).toBe(3);
  });

  it("blocks retrying an already verified attempt", () => {
    const decision = evaluateRetry({
      status: "verified",
      attemptCount: 1,
      updatedAt: now,
      now: new Date("2026-03-01T00:00:00Z"),
    });
    expect(decision.ok).toBe(false);
  });
});

describe("appeal policy", () => {
  it("only allows appeals from rejected or needs_action", () => {
    expect(
      evaluateAppeal({ status: "rejected", attemptCount: 1, appealCount: 0 }).ok,
    ).toBe(true);
    expect(
      evaluateAppeal({ status: "needs_action", attemptCount: 1, appealCount: 0 })
        .ok,
    ).toBe(true);
    expect(
      evaluateAppeal({ status: "pending", attemptCount: 1, appealCount: 0 }).ok,
    ).toBe(false);
    expect(
      evaluateAppeal({ status: "verified", attemptCount: 1, appealCount: 0 }).ok,
    ).toBe(false);
  });

  it("caps the number of appeals", () => {
    const decision = evaluateAppeal({
      status: "rejected",
      attemptCount: 1,
      appealCount: MAX_APPEALS,
    });
    expect(decision.ok).toBe(false);
    expect(decision.block).toBe("appeal_limit");
  });
});

describe("membership action derivation", () => {
  it("activates only on a verified status", () => {
    expect(membershipActionFor("verified", null)).toBe("activate");
    expect(membershipActionFor("verified", "active")).toBe("none");
  });

  it("never activates for pending, needs_action or inconclusive outcomes", () => {
    for (const state of ["pending", "needs_action", "not_started"] as const) {
      expect(membershipActionFor(state, null)).toBe("none");
      expect(membershipActionFor(state, "active")).toBe("none");
    }
  });

  it("revokes on rejection and cancellation", () => {
    expect(membershipActionFor("rejected", "active")).toBe("revoke");
    expect(membershipActionFor("cancelled", "active")).toBe("revoke");
  });

  it("suspends and expires without revoking outright", () => {
    expect(membershipActionFor("suspended", "active")).toBe("suspend");
    expect(membershipActionFor("expired", "active")).toBe("expire");
  });
});

describe("derived UI hints", () => {
  it("tells an unverified user to start verification", () => {
    const hints = deriveHints({
      status: "not_started",
      canRetry: true,
      canAppeal: false,
      providerConfigured: true,
    });
    expect(hints.nextAction).toBe("start_verification");
  });

  it("tells a pending user what is expected", () => {
    expect(
      deriveHints({
        status: "pending",
        canRetry: true,
        canAppeal: false,
        providerConfigured: true,
      }).nextAction,
    ).toBe("complete_provider_flow");
    expect(
      deriveHints({
        status: "pending",
        canRetry: true,
        canAppeal: false,
        providerConfigured: false,
      }).nextAction,
    ).toBe("await_review");
  });

  it("offers an appeal for rejected users", () => {
    const hints = deriveHints({
      status: "rejected",
      canRetry: false,
      canAppeal: true,
      providerConfigured: true,
    });
    expect(hints.canAppeal).toBe(true);
    expect(hints.nextAction).toBe("submit_appeal");
  });

  it("never advertises an appeal while verified", () => {
    const hints = deriveHints({
      status: "verified",
      canRetry: true,
      canAppeal: true,
      providerConfigured: true,
    });
    expect(hints.canAppeal).toBe(false);
    expect(hints.nextAction).toBe("none");
  });
});

describe("attempt expiry", () => {
  it("gives open attempts a review window", () => {
    const expiry = computeAttemptExpiry("pending", new Date("2026-01-01T00:00:00Z"));
    expect(expiry).not.toBeNull();
    expect(expiry!.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("does not expire terminal states", () => {
    expect(computeAttemptExpiry("verified", new Date())).toBeNull();
    expect(computeAttemptExpiry("rejected", new Date())).toBeNull();
  });
});

describe("policy version", () => {
  it("is stamped on attempts", () => {
    expect(VERIFICATION_POLICY_VERSION).toBe("v1");
  });
});

describe("provider payload redaction", () => {
  it("strips identity and credential fields", () => {
    const redacted = redactPayload({
      status: "approved",
      requestId: "abc",
      documentNumber: "1234",
      aadhaar: "9999",
      dateOfBirth: "2000-01-01",
      accessToken: "secret-token",
      nested: { passportImage: "base64...", ok: true },
    });
    expect(redacted).toEqual({
      status: "approved",
      requestId: "abc",
      nested: { ok: true },
    });
  });

  it("truncates very long values", () => {
    const redacted = redactPayload({ note: "x".repeat(500) });
    expect(String(redacted.note).length).toBeLessThanOrEqual(201);
  });
});
