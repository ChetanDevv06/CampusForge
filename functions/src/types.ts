/**
 * Shared Firestore data models for the CampusForge student-verification system.
 *
 * Split of responsibilities:
 *   users/{uid}                 — ordinary profile + mirrored account status
 *   colleges/{collegeId}        — admin-controlled partner college config
 *   verifications/{attemptId}   — ONE verification attempt per (user, college)
 *     ├── private/provider      — opaque provider reference + raw responses
 *     └── audit/{eventId}       — append-only transition history
 *   memberships/{uid}           — college membership, activated only by backend
 *   verification_audit/{id}     — top-level minimal administrative audit trail
 *   rate_limits/{key}           — server-only abuse-prevention counters
 */

// ─── Verification state machine ──────────────────────────────────────────────

export const VERIFICATION_STATES = [
  "not_started",
  "pending",
  "needs_action",
  "verified",
  "rejected",
  "expired",
  "suspended",
  "cancelled",
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const TERMINAL_STATES: readonly VerificationState[] = ["verified", "cancelled"];

/** States in which the student may access college-restricted features. */
export function isAccessGrantedState(state: VerificationState): boolean {
  return state === "verified";
}

// ─── Membership ──────────────────────────────────────────────────────────────

export const MEMBERSHIP_STATES = ["active", "suspended", "revoked", "expired"] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

// ─── Documents ───────────────────────────────────────────────────────────────

/** Client-visible subset of `verifications/{attemptId}`. */
export interface VerificationRecord {
  /** Deterministic attempt id: `${uid}:${collegeId}`. */
  id: string;
  userId: string;
  collegeId: string;
  /** Provider adapter id (e.g. "sheerid"). Null when queued for manual review. */
  providerId: string | null;
  /** Provider program id — resolved server-side, never supplied by the client. */
  providerProgramId: string | null;
  status: VerificationState;
  /** e.g. "provider_redirect" | "manual_review" | "document_review" */
  method: string;
  policyVersion: string;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  /** Provider attempt expiry (usually short). */
  expiresAt?: Date | null;
  /** Membership expiry under policy — see MEMBERSHIP_TTL. */
  membershipExpiresAt?: Date | null;
  /** Coarse, non-sensitive failure info safe to show a student. */
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  /** Backend-computed UI hints. Never authoritative for access decisions. */
  canRetry: boolean;
  canAppeal: boolean;
  nextAction: VerificationNextAction;
  /** Last provider event id processed (idempotency guard). */
  lastEventId?: string | null;
}

export type VerificationNextAction =
  | "none"
  | "start_verification"
  | "complete_provider_flow"
  | "await_review"
  | "provide_more_evidence"
  | "retry"
  | "submit_appeal"
  | "contact_support";

/** `verifications/{attemptId}/private/provider` — never readable by clients. */
export interface VerificationPrivateRecord {
  providerReference: string | null;
  /** Redacted provider responses: no identity documents, no tokens. */
  providerResponses: Record<string, unknown>[];
}

/** `verifications/{attemptId}/audit/{eventId}` and `verification_audit/{id}`. */
export interface VerificationAuditEntry {
  id: string;
  userId: string;
  collegeId: string;
  verificationId: string;
  fromStatus: VerificationState | null;
  toStatus: VerificationState;
  reason: string;
  actor: string; // uid, "system", or "provider:<id>"
  eventId: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/** `memberships/{uid}` */
export interface MembershipRecord {
  userId: string;
  collegeId: string;
  status: MembershipState;
  verificationId: string;
  policyVersion: string;
  method: string;
  activatedAt: Date;
  activatedBy: string;
  updatedAt: Date;
  suspendedAt?: Date | null;
  suspendedBy?: string | null;
  revokedAt?: Date | null;
  revokedBy?: string | null;
  expiresAt?: Date | null;
}

/** `users/{uid}` — fields owned by the client vs. mirrored by the backend. */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  collegeId?: string;
  collegeName?: string;
  collegeShortName?: string;
  colDomain?: string;
  collegeEmail?: string;
  collegeEmailVerified?: boolean;
  createdAt: unknown;
  // ── Backend-mirrored (clients must never write these) ──
  accountStatus?: "restricted" | "active_member" | "suspended";
  verificationStatus?: VerificationState;
  verifiedCollegeId?: string | null;
  membershipStatus?: MembershipState | null;
}

/** `colleges/{collegeId}` — partner college configuration. */
export interface CollegeConfig {
  name: string;
  shortName: string;
  domain: string;
  domains: string[];
  location: string;
  logo?: string | null;
  verified: boolean;
  memberCount: number;
  createdAt?: unknown;
  // ── Verification configuration (admin-controlled) ──
  /** Master gate. When false, startVerification fails closed. */
  verificationEnabled: boolean;
  /** Provider adapter id, e.g. "sheerid". Null => manual review only. */
  verificationProviderId: string | null;
  /** Provider program id, resolved by the backend from this field only. */
  verificationProgramId: string | null;
  /** "provider_redirect" | "manual_review" */
  verificationMethod: string;
}

/** What `getVerificationStatus` returns. Contains no provider references. */
export interface SafeVerificationStatus {
  collegeId: string | null;
  status: VerificationState;
  method: string | null;
  providerConfigured: boolean;
  attemptCount: number;
  policyVersion: string | null;
  createdAt: Date | null;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  canRetry: boolean;
  canAppeal: boolean;
  nextAction: VerificationNextAction;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  /** Whether campus access is currently granted (from membership, not UI). */
  hasCampusAccess: boolean;
  membership: {
    status: MembershipState | null;
    collegeId: string | null;
    expiresAt: Date | null;
  };
}

/** Outcome reported by a provider adapter. */
export type VerificationOutcome =
  | "approved"
  | "rejected"
  | "inconclusive"
  | "needs_action";

export const OUTCOME_TO_STATE: Record<VerificationOutcome, VerificationState> = {
  approved: "verified",
  rejected: "rejected",
  inconclusive: "needs_action",
  needs_action: "needs_action",
};

// ─── Error codes surfaced to the client ──────────────────────────────────────

export const VERIFICATION_ERRORS = {
  NOT_SIGNED_IN: "VERIFICATION_NOT_SIGNED_IN",
  COLLEGE_NOT_FOUND: "VERIFICATION_COLLEGE_NOT_FOUND",
  COLLEGE_NOT_ENABLED: "VERIFICATION_COLLEGE_NOT_ENABLED",
  PROVIDER_NOT_CONFIGURED: "VERIFICATION_PROVIDER_NOT_CONFIGURED",
  PROVIDER_UNAVAILABLE: "VERIFICATION_PROVIDER_UNAVAILABLE",
  PROVIDER_RESULT_INVALID: "VERIFICATION_PROVIDER_RESULT_INVALID",
  INVALID_STATE: "VERIFICATION_INVALID_STATE",
  RATE_LIMITED: "VERIFICATION_RATE_LIMITED",
  RETRY_LIMIT_REACHED: "VERIFICATION_RETRY_LIMIT_REACHED",
  APPEAL_LIMIT_REACHED: "VERIFICATION_APPEAL_LIMIT_REACHED",
  NOT_ADMIN: "VERIFICATION_NOT_ADMIN",
  FORBIDDEN: "VERIFICATION_FORBIDDEN",
  CALLBACK_REJECTED: "VERIFICATION_CALLBACK_REJECTED",
} as const;

export type VerificationErrorCode =
  (typeof VERIFICATION_ERRORS)[keyof typeof VERIFICATION_ERRORS];
