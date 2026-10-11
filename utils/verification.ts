/**
 * Client-side verification service.
 *
 * This module is a thin wrapper over the trusted backend. It can only ever *ask*
 * the backend to do something and *read back* a status — every state change
 * happens server-side. There is deliberately no code path here that can mark a
 * student as verified.
 *
 * The backend is a self-hosted HTTP service (see functions/src/server) rather
 * than a Firebase callable, so the project does not need the Blaze plan. The
 * transport uses plain fetch with the Firebase ID token the app already holds.
 */

import { auth } from "../firebaseConfig";

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

export const NEXT_ACTIONS = [
  "none",
  "start_verification",
  "complete_provider_flow",
  "await_review",
  "provide_more_evidence",
  "retry",
  "submit_appeal",
  "contact_support",
] as const;

export type VerificationNextAction = (typeof NEXT_ACTIONS)[number];

export interface VerificationMembership {
  status: "active" | "suspended" | "revoked" | "expired" | null;
  collegeId: string | null;
  expiresAt: string | null;
}

/** Exactly what the backend returns to a client — never more. */
export interface SafeVerificationStatus {
  collegeId: string | null;
  status: VerificationState;
  method: string | null;
  providerConfigured: boolean;
  attemptCount: number;
  policyVersion: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  canRetry: boolean;
  canAppeal: boolean;
  nextAction: VerificationNextAction;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  /** True only when the backend confirms an active membership. */
  hasCampusAccess: boolean;
  membership: VerificationMembership;
}

export const EMPTY_STATUS: SafeVerificationStatus = {
  collegeId: null,
  status: "not_started",
  method: null,
  providerConfigured: false,
  attemptCount: 0,
  policyVersion: null,
  createdAt: null,
  reviewedAt: null,
  expiresAt: null,
  canRetry: true,
  canAppeal: false,
  nextAction: "start_verification",
  lastErrorCode: null,
  lastErrorMessage: null,
  hasCampusAccess: false,
  membership: { status: null, collegeId: null, expiresAt: null },
};

/**
 * Base URL of the self-hosted verification backend. Not a secret.
 * e.g. https://campusforge-verify.onrender.com
 */
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_VERIFICATION_API_URL || ""
).trim().replace(/\/+$/, "");

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export interface BackendError {
  code: string;
  message: string;
  /** `verificationCode` returned by the backend for client-side branching. */
  verificationCode?: string;
}

/**
 * Human-readable messages for Firebase callable failure codes.
 *
 * `not-found` is the common "functions were never deployed (or the region does
 * not match)" case, which must not be surfaced to a student as the raw protocol
 * string "Not Found".
 */
const CALLABLE_ERROR_MESSAGES: Record<string, string> = {
  unreachable:
    "The verification service could not be reached. Please try again in a few minutes.",
  not_configured:
    "This build of CampusForge is not connected to the verification service. Please reinstall the app or contact support.",
  unavailable:
    "The verification service is temporarily unavailable. Please try again shortly.",
  "resource-exhausted":
    "Too many attempts. Please wait a while before trying again.",
  unauthenticated: "Your session expired. Please sign in again.",
  "permission-denied": "You are not allowed to do that.",
  "failed-precondition":
    "Verification cannot be started for this campus right now.",
  invalid_argument: "Some information was missing or invalid.",
  "deadline-exceeded":
    "The verification service took too long to respond. Please try again.",
  aborted: "The request was interrupted. Please try again.",
  internal:
    "Something went wrong on our side. Please try again in a few minutes.",
  network: "You appear to be offline. Please check your connection.",
};

/**
 * Failure codes that mean "try again later" rather than "you did it wrong".
 * `unreachable` means the backend did not answer.
 */
export const TRANSIENT_ERROR_CODES = new Set([
  "unreachable",
  "unavailable",
  "internal",
  "deadline-exceeded",
  "aborted",
  "network",
  "unknown",
]);

function toBackendError(error: unknown): BackendError {
  const anyError = error as {
    code?: string;
    message?: string;
    details?: { verificationCode?: string };
  };
  const code = anyError?.code || "unknown";
  return {
    code,
    message:
      CALLABLE_ERROR_MESSAGES[code] ||
      anyError?.message ||
      "Something went wrong. Please try again.",
    verificationCode: anyError?.details?.verificationCode,
  };
}

/**
 * Calls the self-hosted backend.
 *
 * The request carries the signed-in user's Firebase ID token, and the response
 * uses the same `{ result }` / `{ error }` envelope the Firebase callables used,
 * so the rest of the app is unchanged.
 */
async function call<TRequest, TResponse>(
  path: string,
  payload: TRequest,
): Promise<TResponse> {
  if (!API_BASE_URL) {
    // Build configuration, not a transient outage: retrying cannot fix this.
    throw toBackendError({
      code: "not_configured",
      message:
        "The verification service is not configured for this build. Please update the app or contact CampusForge support.",
    });
  }

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload ?? {}),
    });
  } catch {
    // fetch only rejects on a transport-level failure.
    throw toBackendError({
      code: "network",
      message: "You appear to be offline. Please check your connection.",
    });
  }

  const body = (await response.json().catch(() => null)) as
    | { result?: TResponse; error?: { message?: string; status?: string; details?: { verificationCode?: string } } }
    | null;

  if (!response.ok || !body?.result) {
    throw toBackendError({
      code: body?.error?.status ?? (response.ok ? "internal" : "unavailable"),
      message:
        body?.error?.message ??
        (response.status === 404
          ? "The verification service could not be reached. Please try again in a few minutes."
          : "Something went wrong. Please try again."),
      details: body?.error?.details,
    });
  }

  return body.result;
}

export interface StartVerificationRequest {
  collegeId: string;
}

export interface StartVerificationResponse {
  attemptId: string;
  redirectUrl: string | null;
  reused: boolean;
  status: SafeVerificationStatus;
}

export const startVerification = (collegeId: string) =>
  call<StartVerificationRequest, StartVerificationResponse>("/verify/start", {
    collegeId,
  });

export interface StatusResponse {
  status: SafeVerificationStatus;
}

export const getVerificationStatus = (collegeId?: string | null) =>
  call<{ collegeId?: string }, StatusResponse>("/verify/status", {
    collegeId: collegeId ?? undefined,
  });

export const retryVerification = (collegeId: string) =>
  call<StartVerificationRequest, StartVerificationResponse>(
    "/verify/retry",
    { collegeId },
  );

export const submitAppeal = (collegeId: string, reason: string) =>
  call<
    { collegeId: string; reason: string },
    { appealId: string; attemptId: string; status: SafeVerificationStatus }
  >("/verify/appeal", { collegeId, reason });

export const cancelVerification = (collegeId: string) =>
  call<StartVerificationRequest, { ok: boolean }>("/verify/cancel", {
    collegeId,
  });

/** True when the student must be routed into the verification flow. */
export function requiresVerification(status: SafeVerificationStatus | null): boolean {
  if (!status) return true;
  if (status.hasCampusAccess) return false;
  return status.status !== "verified";
}

export function statusLabel(status: SafeVerificationStatus | null): string {
  switch (status?.status) {
    case "verified":
      return "Verified student";
    case "pending":
      return "Verification in progress";
    case "needs_action":
      return "More information needed";
    case "rejected":
      return "Verification unsuccessful";
    case "expired":
      return "Verification expired";
    case "suspended":
      return "Access suspended";
    case "cancelled":
      return "Verification cancelled";
    case "not_started":
    default:
      return "Not verified";
  }
}
