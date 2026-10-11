/**
 * VerificationService — the trusted core of the verification lifecycle.
 *
 * All state transitions and every membership activation go through this class.
 * It is deliberately free of Firebase Function plumbing so it can be unit
 * tested and reused by callables, the provider webhook handler and scheduled
 * expiry jobs alike.
 *
 * Security invariants enforced here:
 *  - The client never supplies a status, a college or a provider program id.
 *  - Every attempt is bound to (userId, collegeId) at creation.
 *  - Provider events are matched to the bound attempt before any effect.
 *  - Event processing is idempotent per event id.
 *  - Membership activation requires a validated `approved` outcome.
 *  - Membership updates happen inside the same transaction as the status.
 */

import * as admin from "firebase-admin";
import {
  CollegeConfig,
  MembershipRecord,
  MembershipState,
  SafeVerificationStatus,
  VerificationAuditEntry,
  VerificationNextAction,
  VerificationOutcome,
  VerificationPrivateRecord,
  VerificationRecord,
  VerificationState,
} from "./types";
import {
  REVIEW_TTL_MS,
  assertTransition,
  canTransition,
  deriveHints,
  evaluateAppeal,
  evaluateRetry,
  isVerificationState,
  MEMBERSHIP_TTL_MS,
  membershipActionFor,
  outcomeToState,
  VERIFICATION_POLICY_VERSION,
} from "./policy";
import {
  COLLECTIONS,
  PATHS,
  SAFE_VERIFICATION_FIELDS,
  attemptIdFor,
  getDb,
} from "./db";

export interface AttemptView {
  record: VerificationRecord;
  privateRecord: VerificationPrivateRecord;
}

export class VerificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const anyValue = value as { toDate?: () => Date };
  if (typeof anyValue.toDate === "function") return anyValue.toDate();
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pick<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

export class VerificationService {
  constructor(private readonly db = getDb()) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async getAttempt(
    userId: string,
    collegeId: string,
  ): Promise<VerificationRecord | null> {
    const snap = await this.db
      .doc(PATHS.verification(attemptIdFor(userId, collegeId)))
      .get();
    return snap.exists ? this.toRecord(snap.id, snap.data() || {}) : null;
  }

  async getPrivateRecord(attemptId: string): Promise<VerificationPrivateRecord> {
    const snap = await this.db.doc(PATHS.verificationPrivate(attemptId)).get();
    if (!snap.exists) return { providerReference: null, providerResponses: [] };
    const data = snap.data() || {};
    return {
      providerReference: (data.providerReference as string) ?? null,
      providerResponses: Array.isArray(data.providerResponses)
        ? (data.providerResponses as Record<string, unknown>[])
        : [],
    };
  }

  async getMembership(userId: string): Promise<MembershipRecord | null> {
    const snap = await this.db.doc(PATHS.membership(userId)).get();
    return snap.exists ? this.toMembership(snap.data() || {}) : null;
  }

  async getCollegeConfig(collegeId: string): Promise<CollegeConfig | null> {
    if (!collegeId || typeof collegeId !== "string") return null;
    const snap = await this.db.doc(PATHS.college(collegeId)).get();
    if (!snap.exists) return null;
    return this.toCollegeConfig(snap.data() || {});
  }

  /** Safe, read-only status projection for exactly one user + college. */
  async getSafeStatus(
    userId: string,
    collegeId: string | null,
  ): Promise<SafeVerificationStatus> {
    const college = collegeId ? await this.getCollegeConfig(collegeId) : null;
    const providerConfigured =
      !!college?.verificationEnabled &&
      (college.verificationProviderId
        ? !!college.verificationProgramId
        : college.verificationMethod === "manual_review");

    const membership = await this.getMembership(userId);
    const attempt = collegeId
      ? await this.getAttempt(userId, collegeId)
      : null;

    const status: VerificationState = attempt?.status ?? "not_started";
    const hints = deriveHints({
      status,
      canRetry: attempt?.canRetry ?? true,
      canAppeal: attempt?.canAppeal ?? false,
      providerConfigured,
    });

    // Access is granted only by an active membership for this college.
    const hasCampusAccess =
      !!membership &&
      membership.status === "active" &&
      (!collegeId || membership.collegeId === collegeId) &&
      !this.isMembershipExpired(membership);

    return {
      collegeId: collegeId ?? null,
      status,
      method: attempt?.method ?? null,
      providerConfigured,
      attemptCount: attempt?.attemptCount ?? 0,
      policyVersion: attempt?.policyVersion ?? VERIFICATION_POLICY_VERSION,
      createdAt: attempt?.createdAt ?? null,
      reviewedAt: attempt?.reviewedAt ?? null,
      expiresAt: attempt?.expiresAt ?? null,
      canRetry: hints.canRetry,
      canAppeal: hints.canAppeal,
      nextAction: hints.nextAction,
      lastErrorCode: attempt?.lastErrorCode ?? null,
      lastErrorMessage: attempt?.lastErrorMessage ?? null,
      hasCampusAccess,
      membership: {
        status: membership?.status ?? null,
        collegeId: membership?.collegeId ?? null,
        expiresAt: membership?.expiresAt ?? null,
      },
    };
  }

  // ── startVerification ────────────────────────────────────────────────────

  /**
   * Create (or resume) a verification attempt for the user's selected college.
   * Returns the provider redirect URL when a provider flow is available.
   */
  async startAttempt(input: {
    userId: string;
    collegeId: string;
    providerProgramId?: string | null;
    /** Injected by the callable so this module stays Firebase-agnostic. */
    initiateProvider?: (args: {
      attemptId: string;
      programId: string;
      collegeId: string;
      userId: string;
    }) => Promise<{ redirectUrl: string; providerReference: string }>;
  }): Promise<{
    status: SafeVerificationStatus;
    attemptId: string;
    redirectUrl: string | null;
    reused: boolean;
  }> {
    const { userId, collegeId } = input;
    const attemptId = attemptIdFor(userId, collegeId);

    const college = await this.getCollegeConfig(collegeId);
    if (!college) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_NOT_FOUND",
        "The selected college is not a configured partner college.",
      );
    }
    if (!college.verificationEnabled) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_NOT_ENABLED",
        "Verification is not enabled for this campus yet. Please contact support.",
      );
    }

    const userSnap = await this.db.doc(PATHS.user(userId)).get();
    if (!userSnap.exists) {
      throw new VerificationError(
        "VERIFICATION_FORBIDDEN",
        "Complete your profile before verifying.",
      );
    }
    const userData = userSnap.data() || {};
    // The verification must apply to the college the user actually selected.
    if (userData.collegeId !== collegeId) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_MISMATCH",
        "This verification does not match your selected college.",
      );
    }

    const existing = await this.getAttempt(userId, collegeId);
    if (existing && existing.status === "pending") {
      // Resume an in-flight attempt instead of duplicating it.
      return {
        status: await this.getSafeStatus(userId, collegeId),
        attemptId,
        redirectUrl: null,
        reused: true,
      };
    }

    const now = new Date();
    const retry = evaluateRetry({
      status: existing?.status ?? "not_started",
      attemptCount: existing?.attemptCount ?? 0,
      updatedAt: existing?.updatedAt ?? null,
      now,
    });
    if (!retry.ok) {
      throw new VerificationError(
        retry.block === "cooldown"
          ? "VERIFICATION_RATE_LIMITED"
          : "VERIFICATION_RETRY_LIMIT_REACHED",
        retry.message || "Too many verification attempts.",
        429,
      );
    }

    const from = existing?.status ?? null;
    assertTransition(from, "pending"); // not_started/null → pending is always legal

    const programId =
      college.verificationMethod === "manual_review"
        ? null
        : input.providerProgramId ?? college.verificationProgramId ?? null;

    if (
      college.verificationMethod !== "manual_review" &&
      (!college.verificationProviderId || !programId)
    ) {
      // Fail closed: a provider flow was requested but is not configured.
      throw new VerificationError(
        "VERIFICATION_PROVIDER_NOT_CONFIGURED",
        "Student verification is not yet available for this campus. Our team has been notified.",
        503,
      );
    }

    if (college.verificationMethod !== "manual_review" && !input.initiateProvider) {
      // The provider adapter is not registered server-side. Without it there
      // is no authoritative result to validate, so verification fails closed
      // rather than sitting in a pending state nobody can resolve.
      throw new VerificationError(
        "VERIFICATION_PROVIDER_NOT_CONFIGURED",
        "Student verification is not yet available for this campus. Our team has been notified.",
        503,
      );
    }

    let providerReference: string | null = null;
    let redirectUrl: string | null = null;

    if (input.initiateProvider && programId) {
      try {
        const initiated = await input.initiateProvider({
          attemptId,
          programId,
          collegeId,
          userId,
        });
        redirectUrl = initiated.redirectUrl;
        // The opaque provider reference is retained server-side only; it is
        // written to the private subcollection below and never returned.
        providerReference = initiated.providerReference;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Provider unavailable";
        await this.appendAudit(attemptId, {
          userId,
          collegeId,
          verificationId: attemptId,
          fromStatus: from,
          toStatus: existing?.status ?? "not_started",
          reason: `provider_initiate_failed: ${message}`,
          actor: "system",
          eventId: null,
        });
        throw new VerificationError(
          "VERIFICATION_PROVIDER_UNAVAILABLE",
          "The verification service is temporarily unavailable. Please try again shortly.",
          503,
        );
      }
    }

    const record: Omit<VerificationRecord, "id"> = {
      userId,
      collegeId,
      providerId: college.verificationProviderId,
      providerProgramId: programId,
      status: "pending",
      method:
        college.verificationMethod === "manual_review"
          ? "manual_review"
          : "provider_redirect",
      policyVersion: VERIFICATION_POLICY_VERSION,
      attemptCount: retry.nextAttemptCount,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      reviewedAt: null,
      expiresAt: new Date(now.getTime() + REVIEW_TTL_MS),
      lastErrorCode: null,
      lastErrorMessage: null,
      canRetry: true,
      canAppeal: false,
      nextAction: programId ? "complete_provider_flow" : "await_review",
    };

    await this.db.runTransaction(async (tx) => {
      const attemptRef = this.db.doc(PATHS.verification(attemptId));
      const privateRef = this.db.doc(PATHS.verificationPrivate(attemptId));
      const existingSnap = await tx.get(attemptRef);

      // Re-check inside the transaction to keep the transition race-safe.
      if (existingSnap.exists && existingSnap.data()?.status === "pending") {
        return;
      }

      tx.set(
        attemptRef,
        {
          ...record,
          id: attemptId,
          createdAt: admin.firestore.Timestamp.fromDate(record.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(record.updatedAt),
          expiresAt: admin.firestore.Timestamp.fromDate(record.expiresAt!),
        },
        { merge: true },
      );
      tx.set(
        privateRef,
        {
          providerReference,
          providerResponses: [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      // Merge, never replace: this document is the student's profile.
      tx.update(this.db.doc(PATHS.user(userId)), {
        verificationStatus: "pending",
        accountStatus: "restricted",
      });
    });

    await this.appendAudit(attemptId, {
      userId,
      collegeId,
      verificationId: attemptId,
      fromStatus: from,
      toStatus: "pending",
      reason: "attempt_started",
      actor: "user",
      eventId: null,
      metadata: {
        attemptCount: retry.nextAttemptCount,
        method: record.method,
        providerConfigured: !!programId,
      },
    });

    return {
      status: await this.getSafeStatus(userId, collegeId),
      attemptId,
      redirectUrl,
      reused: false,
    };
  }

  // ── Provider result processing ───────────────────────────────────────────

  /**
   * Apply a validated provider outcome to an attempt.
   *
   * `providerReference` and `eventId` come from the inbound event and MUST
   * match the stored attempt; otherwise the event is rejected. `eventId`
   * de-duplicates replayed webhooks.
   */
  async applyProviderOutcome(input: {
    attemptId: string;
    providerId: string;
    providerReference: string;
    providerProgramId: string;
    outcome: VerificationOutcome;
    eventId: string | null;
    reason?: string;
    actor?: string;
    reviewedAt?: Date;
    payload?: Record<string, unknown>;
  }): Promise<{ applied: boolean; status: VerificationState }> {
    const attemptSnap = await this.db
      .doc(PATHS.verification(input.attemptId))
      .get();

    if (!attemptSnap.exists) {
      // Unknown attempt: never create state from an unattributable event.
      throw new VerificationError(
        "VERIFICATION_PROVIDER_RESULT_INVALID",
        "Unknown verification attempt.",
      );
    }

    const attempt = this.toRecord(attemptSnap.id, attemptSnap.data() || {});
    const privateRecord = await this.getPrivateRecord(input.attemptId);

    if (attempt.providerId !== input.providerId) {
      throw new VerificationError(
        "VERIFICATION_PROVIDER_RESULT_INVALID",
        "Provider mismatch for this verification attempt.",
      );
    }
    if (
      attempt.providerProgramId &&
      attempt.providerProgramId !== input.providerProgramId
    ) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_MISMATCH",
        "Provider program does not match this college.",
      );
    }
    if (
      privateRecord.providerReference &&
      privateRecord.providerReference !== input.providerReference
    ) {
      throw new VerificationError(
        "VERIFICATION_CALLBACK_REJECTED",
        "Provider reference does not match this verification attempt.",
      );
    }

    // Idempotency: the same provider event must never be applied twice.
    if (input.eventId && attempt.lastEventId === input.eventId) {
      return { applied: false, status: attempt.status };
    }

    const nextState = outcomeToState(input.outcome);
    assertTransition(attempt.status, nextState);

    const now = new Date();

    await this.db.runTransaction(async (tx) => {
      const attemptRef = this.db.doc(PATHS.verification(input.attemptId));
      const current = (await tx.get(attemptRef)).data() || {};
      if (input.eventId && current.lastEventId === input.eventId) return; // replay

      // Decide the membership action from the CURRENT stored membership, so a
      // concurrent event cannot double-activate or reactivate a revoked one.
      const membershipSnap = await tx.get(
        this.db.doc(PATHS.membership(attempt.userId)),
      );
      const currentStatus = membershipSnap.exists
        ? ((membershipSnap.data()?.status as MembershipState) ?? null)
        : null;
      const membershipAction = membershipActionFor(nextState, currentStatus);

      const update: Record<string, unknown> = {
        status: nextState,
        reviewedAt: admin.firestore.Timestamp.fromDate(input.reviewedAt ?? now),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEventId: input.eventId,
        expiresAt:
          nextState === "verified"
            ? admin.firestore.Timestamp.fromDate(
                new Date(now.getTime() + MEMBERSHIP_TTL_MS),
              )
            : admin.firestore.FieldValue.delete(),
      };

      if (nextState === "verified") {
        update.canAppeal = false;
        update.nextAction = "none";
      } else if (nextState === "rejected") {
        update.canAppeal = true;
        update.canRetry = false;
        update.nextAction = "submit_appeal";
      } else if (nextState === "needs_action") {
        update.canAppeal = true;
        update.nextAction = "provide_more_evidence";
      }

      tx.set(attemptRef, update, { merge: true });

      tx.set(
        this.db.doc(PATHS.verificationPrivate(input.attemptId)),
        {
          providerReference: input.providerReference,
          providerResponses: admin.firestore.FieldValue.arrayUnion(
            input.payload ? redactPayload(input.payload) : {},
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      if (membershipAction !== "none") {
        await this.applyMembershipActionInTransaction(tx, {
          userId: attempt.userId,
          collegeId: attempt.collegeId,
          verificationId: input.attemptId,
          action: membershipAction,
          actor: input.actor ?? `provider:${input.providerId}`,
          reason: input.reason ?? input.outcome,
          now,
        });
      }

      // Merge, never replace: this document is the student's profile.
      tx.set(this.db.doc(PATHS.user(attempt.userId)), {
        verificationStatus: nextState,
        accountStatus:
          nextState === "verified"
            ? "active_member"
            : nextState === "suspended"
              ? "suspended"
              : "restricted",
        verifiedCollegeId: nextState === "verified" ? attempt.collegeId : null,
      }, { merge: true });
    });

    await this.appendAudit(input.attemptId, {
      userId: attempt.userId,
      collegeId: attempt.collegeId,
      verificationId: input.attemptId,
      fromStatus: attempt.status,
      toStatus: nextState,
      reason: input.reason ?? `provider_outcome:${input.outcome}`,
      actor: input.actor ?? `provider:${input.providerId}`,
      eventId: input.eventId,
      metadata: { outcome: input.outcome },
    });

    return { applied: true, status: nextState };
  }

  // ── retryVerification ────────────────────────────────────────────────────

  async retryAttempt(input: {
    userId: string;
    collegeId: string;
    providerProgramId?: string | null;
    initiateProvider?: Parameters<VerificationService["startAttempt"]>[0]["initiateProvider"];
  }): Promise<{ status: SafeVerificationStatus; attemptId: string; redirectUrl: string | null }> {
    const existing = await this.getAttempt(input.userId, input.collegeId);
    if (!existing) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "No verification attempt exists for this college yet.",
      );
    }
    // Only failed/expired/needs-action attempts may be retried.
    if (!["rejected", "expired", "needs_action", "cancelled"].includes(existing.status)) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        `A ${existing.status} verification cannot be retried.`,
      );
    }
    return this.startAttempt(input);
  }

  // ── submitAppeal ─────────────────────────────────────────────────────────

  async submitAppeal(input: {
    userId: string;
    collegeId: string;
    reason: string;
  }): Promise<{ status: SafeVerificationStatus; attemptId: string; appealId: string }> {
    const reason = (input.reason || "").trim();
    if (reason.length < 10) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "Please describe your appeal in at least 10 characters.",
      );
    }
    if (reason.length > 2000) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "Appeal text is too long (max 2000 characters).",
      );
    }

    const attemptId = attemptIdFor(input.userId, input.collegeId);
    const attempt = await this.getAttempt(input.userId, input.collegeId);
    if (!attempt) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "No verification attempt exists for this college yet.",
      );
    }

    const appealCount = await this.countAppeals(attemptId);
    const decision = evaluateAppeal({
      status: attempt.status,
      attemptCount: attempt.attemptCount,
      appealCount,
    });
    if (!decision.ok) {
      throw new VerificationError(
        decision.block === "appeal_limit"
          ? "VERIFICATION_APPEAL_LIMIT_REACHED"
          : "VERIFICATION_INVALID_STATE",
        decision.message || "Appeal not allowed.",
        decision.block === "appeal_limit" ? 429 : 412,
      );
    }

    const now = new Date();
    const toState: VerificationState = "needs_action";
    assertTransition(attempt.status, toState);

    const appealDocId = `appeal:${now.getTime()}`;
    await this.db.runTransaction(async (tx) => {
      tx.set(
        this.db.doc(PATHS.verification(attemptId)),
        {
          status: toState,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedAt: admin.firestore.Timestamp.fromDate(now),
          nextAction: "await_review",
          canAppeal: false,
          lastErrorCode: "APPEAL_SUBMITTED",
          lastErrorMessage: "Your appeal has been submitted for review.",
        },
        { merge: true },
      );
      tx.set(
        this.db.doc(PATHS.verificationAudit(attemptId, appealDocId)),
        {
          id: appealDocId,
          userId: input.userId,
          collegeId: input.collegeId,
          verificationId: attemptId,
          fromStatus: attempt.status,
          toStatus: toState,
          reason: `appeal_submitted: ${reason}`,
          actor: input.userId,
          eventId: null,
          kind: "appeal",
          createdAt: admin.firestore.Timestamp.fromDate(now),
        },
      );
      // Merge, never replace: this document is the student's profile.
      tx.set(
        this.db.doc(PATHS.user(input.userId)),
        {
          verificationStatus: toState,
          accountStatus: "restricted",
        },
        { merge: true },
      );
    });

    return {
      status: await this.getSafeStatus(input.userId, input.collegeId),
      attemptId,
      appealId: appealDocId,
    };
  }

  // ── cancelVerification ───────────────────────────────────────────────────

  async cancelAttempt(input: { userId: string; collegeId: string }): Promise<void> {
    const attemptId = attemptIdFor(input.userId, input.collegeId);
    const attempt = await this.getAttempt(input.userId, input.collegeId);
    if (!attempt) return;
    if (!canTransition(attempt.status, "cancelled")) return;

    await this.db
      .doc(PATHS.verification(attemptId))
      .set(
        {
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          nextAction: "retry",
        },
        { merge: true },
      );
    await this.appendAudit(attemptId, {
      userId: input.userId,
      collegeId: input.collegeId,
      verificationId: attemptId,
      fromStatus: attempt.status,
      toStatus: "cancelled",
      reason: "cancelled_by_user",
      actor: input.userId,
      eventId: null,
    });
  }

  // ── adminAdjudicate ──────────────────────────────────────────────────────

  /**
   * Admin-gated manual decision. This is the only human-in-the-loop path and
   * it never runs automatically; an admin must approve explicitly.
   */
  async adjudicate(input: {
    userId: string;
    collegeId: string;
    outcome: VerificationOutcome;
    adminId: string;
    reason: string;
  }): Promise<{ status: VerificationState }> {
    const attemptId = attemptIdFor(input.userId, input.collegeId);
    const attempt = await this.getAttempt(input.userId, input.collegeId);
    if (!attempt) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "No verification attempt exists for this college.",
      );
    }
    const nextState = outcomeToState(input.outcome);
    assertTransition(attempt.status, nextState);

    const now = new Date();

    await this.db.runTransaction(async (tx) => {
      // Decide the membership action from the CURRENT stored membership.
      const membershipSnap = await tx.get(
        this.db.doc(PATHS.membership(input.userId)),
      );
      const currentStatus = membershipSnap.exists
        ? ((membershipSnap.data()?.status as MembershipState) ?? null)
        : null;
      const membershipAction = membershipActionFor(nextState, currentStatus);

      tx.set(
        this.db.doc(PATHS.verification(attemptId)),
        {
          status: nextState,
          reviewedAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastEventId: null,
          canAppeal: nextState === "rejected",
          nextAction:
            nextState === "verified"
              ? "none"
              : nextState === "rejected"
                ? "submit_appeal"
                : "provide_more_evidence",
        },
        { merge: true },
      );

      if (membershipAction !== "none") {
        await this.applyMembershipActionInTransaction(tx, {
          userId: input.userId,
          collegeId: input.collegeId,
          verificationId: attemptId,
          action: membershipAction,
          actor: `admin:${input.adminId}`,
          reason: input.reason,
          now,
        });
      }

      // Merge, never replace: this document is the student's profile.
      tx.set(this.db.doc(PATHS.user(input.userId)), {
        verificationStatus: nextState,
        accountStatus:
          nextState === "verified"
            ? "active_member"
            : nextState === "suspended"
              ? "suspended"
              : "restricted",
        verifiedCollegeId: nextState === "verified" ? input.collegeId : null,
      }, { merge: true });
    });

    await this.appendAudit(attemptId, {
      userId: input.userId,
      collegeId: input.collegeId,
      verificationId: attemptId,
      fromStatus: attempt.status,
      toStatus: nextState,
      reason: `admin_decision:${input.outcome}: ${input.reason}`,
      actor: `admin:${input.adminId}`,
      eventId: null,
    });

    return { status: nextState };
  }

  // ── revokeMembership ─────────────────────────────────────────────────────

  async revokeMembership(input: {
    userId: string;
    action: "suspend" | "revoke" | "expire" | "reinstate";
    adminId: string;
    reason: string;
  }): Promise<void> {
    const membership = await this.getMembership(input.userId);
    if (!membership) {
      throw new VerificationError(
        "VERIFICATION_INVALID_STATE",
        "No membership exists for this user.",
      );
    }

    const now = new Date();
    const nextStatus: MembershipState =
      input.action === "reinstate"
        ? "active"
        : input.action === "suspend"
          ? "suspended"
          : input.action === "expire"
            ? "expired"
            : "revoked";

    const verificationState: VerificationState =
      input.action === "reinstate"
        ? "verified"
        : input.action === "suspend"
          ? "suspended"
          : "expired";

    await this.db.runTransaction(async (tx) => {
      tx.set(
        this.db.doc(PATHS.membership(input.userId)),
        {
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(input.action === "suspend"
            ? { suspendedAt: admin.firestore.Timestamp.fromDate(now), suspendedBy: input.adminId }
            : {}),
          ...(input.action === "revoke"
            ? { revokedAt: admin.firestore.Timestamp.fromDate(now), revokedBy: input.adminId }
            : {}),
          ...(input.action === "expire"
            ? { expiresAt: admin.firestore.Timestamp.fromDate(now) }
            : {}),
          ...(input.action === "reinstate"
            ? {
                suspendedAt: null,
                revokedAt: null,
                expiresAt: null,
                activatedAt: admin.firestore.Timestamp.fromDate(now),
              }
            : {}),
        },
        { merge: true },
      );

      if (input.action !== "reinstate") {
        tx.set(
          this.db.doc(
            PATHS.verification(
              attemptIdFor(input.userId, membership.collegeId),
            ),
          ),
          {
            status: verificationState,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      // Merge, never replace: this document is the student's profile.
      tx.set(this.db.doc(PATHS.user(input.userId)), {
        verificationStatus: verificationState,
        accountStatus:
          input.action === "reinstate"
            ? "active_member"
            : input.action === "suspend"
              ? "suspended"
              : "restricted",
      }, { merge: true });
    });

    await this.appendAudit(
      attemptIdFor(input.userId, membership.collegeId),
      {
        userId: input.userId,
        collegeId: membership.collegeId,
        verificationId: attemptIdFor(input.userId, membership.collegeId),
        fromStatus: attemptStatusForMembershipAction(input.action),
        toStatus: verificationState,
        reason: `membership_${input.action}: ${input.reason}`,
        actor: `admin:${input.adminId}`,
        eventId: null,
      },
    );

    // Top-level audit trail of administrative actions.
    await this.db.collection(COLLECTIONS.verification_audit).add({
      userId: input.userId,
      collegeId: membership.collegeId,
      action: `membership_${input.action}`,
      actor: `admin:${input.adminId}`,
      reason: input.reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // ── expiry sweep ─────────────────────────────────────────────────────────

  async expireStaleAttempts(now = new Date()): Promise<number> {
    const snap = await this.db
      .collection(COLLECTIONS.verifications)
      .where("status", "in", ["pending", "needs_action"])
      .where("expiresAt", "<=", admin.firestore.Timestamp.fromDate(now))
      .limit(200)
      .get();

    let expired = 0;
    for (const doc of snap.docs) {
      const attempt = this.toRecord(doc.id, doc.data());
      if (!canTransition(attempt.status, "expired")) continue;
      await doc.ref.set(
        {
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          nextAction: "retry",
        },
        { merge: true },
      );
      await this.appendAudit(doc.id, {
        userId: attempt.userId,
        collegeId: attempt.collegeId,
        verificationId: doc.id,
        fromStatus: attempt.status,
        toStatus: "expired",
        reason: "attempt_expired",
        actor: "system",
        eventId: null,
      });
      expired += 1;
    }
    return expired;
  }

  // ── Membership internals ─────────────────────────────────────────────────

  private isMembershipExpired(membership: MembershipRecord): boolean {
    if (!membership.expiresAt) return false;
    return new Date(membership.expiresAt).getTime() <= Date.now();
  }

  private async applyMembershipActionInTransaction(
    tx: admin.firestore.Transaction,
    input: {
      userId: string;
      collegeId: string;
      verificationId: string;
      action: "activate" | "suspend" | "revoke" | "expire";
      actor: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    const ref = this.db.doc(PATHS.membership(input.userId));

    if (input.action === "activate") {
      // Single-document-per-user guarantees at most one membership, so a
      // replay or duplicate callback cannot create a second one.
      tx.set(
        ref,
        {
          userId: input.userId,
          collegeId: input.collegeId,
          status: "active",
          verificationId: input.verificationId,
          policyVersion: VERIFICATION_POLICY_VERSION,
          method: "provider",
          activatedAt: admin.firestore.Timestamp.fromDate(input.now),
          activatedBy: input.actor,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(input.now.getTime() + MEMBERSHIP_TTL_MS),
          ),
          suspendedAt: null,
          revokedAt: null,
        },
        { merge: true },
      );
      return;
    }

    const patch: Record<string, unknown> = {
      status: input.action === "suspend" ? "suspended" : input.action === "expire" ? "expired" : "revoked",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (input.action === "suspend") {
      patch.suspendedAt = admin.firestore.Timestamp.fromDate(input.now);
      patch.suspendedBy = input.actor;
    }
    if (input.action === "revoke") {
      patch.revokedAt = admin.firestore.Timestamp.fromDate(input.now);
      patch.revokedBy = input.actor;
    }
    if (input.action === "expire") {
      patch.expiresAt = admin.firestore.Timestamp.fromDate(input.now);
    }
    tx.set(ref, patch, { merge: true });
  }

  private async countAppeals(attemptId: string): Promise<number> {
    const snap = await this.db
      .collection(`${COLLECTIONS.verifications}/${attemptId}/audit`)
      .where("kind", "==", "appeal")
      .get();
    return snap.size;
  }

  private async appendAudit(
    attemptId: string,
    entry: Omit<VerificationAuditEntry, "id" | "createdAt">,
  ): Promise<void> {
    const id = `${entry.toStatus}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await this.db
      .doc(PATHS.verificationAudit(attemptId, id))
      .set({
        ...entry,
        id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }

  // ── Mapping helpers ──────────────────────────────────────────────────────

  private toRecord(id: string, data: Record<string, unknown>): VerificationRecord {
    const status = isVerificationState(data.status) ? data.status : "not_started";
    return {
      id,
      userId: String(data.userId ?? ""),
      collegeId: String(data.collegeId ?? ""),
      providerId: (data.providerId as string) ?? null,
      providerProgramId: (data.providerProgramId as string) ?? null,
      status,
      method: String(data.method ?? "manual_review"),
      policyVersion: String(data.policyVersion ?? VERIFICATION_POLICY_VERSION),
      attemptCount: Number(data.attemptCount ?? 0),
      createdAt: toDate(data.createdAt) ?? new Date(0),
      updatedAt: toDate(data.updatedAt) ?? toDate(data.createdAt) ?? new Date(0),
      reviewedAt: toDate(data.reviewedAt),
      expiresAt: toDate(data.expiresAt),
      membershipExpiresAt: null,
      lastErrorCode: (data.lastErrorCode as string) ?? null,
      lastErrorMessage: (data.lastErrorMessage as string) ?? null,
      canRetry: data.canRetry !== false,
      canAppeal: data.canAppeal === true,
      nextAction: (data.nextAction as VerificationNextAction) ?? "contact_support",
      lastEventId: (data.lastEventId as string) ?? null,
    };
  }

  private toMembership(data: Record<string, unknown>): MembershipRecord {
    return {
      userId: String(data.userId ?? ""),
      collegeId: String(data.collegeId ?? ""),
      status: (data.status as MembershipState) ?? "revoked",
      verificationId: String(data.verificationId ?? ""),
      policyVersion: String(data.policyVersion ?? VERIFICATION_POLICY_VERSION),
      method: String(data.method ?? ""),
      activatedAt: toDate(data.activatedAt) ?? new Date(0),
      activatedBy: String(data.activatedBy ?? ""),
      updatedAt: toDate(data.updatedAt) ?? new Date(0),
      suspendedAt: toDate(data.suspendedAt),
      suspendedBy: (data.suspendedBy as string) ?? null,
      revokedAt: toDate(data.revokedAt),
      revokedBy: (data.revokedBy as string) ?? null,
      expiresAt: toDate(data.expiresAt),
    };
  }

  private toCollegeConfig(data: Record<string, unknown>): CollegeConfig {
    return {
      name: String(data.name ?? ""),
      shortName: String(data.shortName ?? ""),
      domain: String(data.domain ?? ""),
      domains: Array.isArray(data.domains) ? (data.domains as string[]) : [],
      location: String(data.location ?? ""),
      logo: (data.logo as string) ?? null,
      verified: data.verified === true,
      memberCount: Number(data.memberCount ?? 0),
      createdAt: data.createdAt ?? null,
      verificationEnabled: data.verificationEnabled === true,
      verificationProviderId: (data.verificationProviderId as string) ?? null,
      verificationProgramId: (data.verificationProgramId as string) ?? null,
      verificationMethod: String(data.verificationMethod ?? "manual_review"),
    };
  }
}

function attemptStatusForMembershipAction(
  action: "suspend" | "revoke" | "expire" | "reinstate",
): VerificationState {
  switch (action) {
    case "suspend":
      return "verified";
    case "expire":
      return "verified";
    case "revoke":
      return "rejected";
    case "reinstate":
    default:
      return "suspended";
  }
}

/**
 * Strip anything that could carry identity data or credentials before an
 * audit copy of a provider response is persisted.
 */
export function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const BLOCKED = /document|aadhaar|dob|birth|passport|photo|token|secret|authorization|password|address|phone|national/i;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED.test(key)) continue;
    if (value && typeof value === "object") {
      out[key] = redactPayload(value as Record<string, unknown>);
    } else if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export { pick, toDate, SAFE_VERIFICATION_FIELDS };
