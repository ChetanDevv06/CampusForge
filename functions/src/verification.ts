/**
 * Shared verification provider contract.
 *
 * This module is provider-agnostic and intentionally tiny — the verification
 * state machine itself lives in `policy.ts` / `types.ts`.
 *
 * Every provider adapter is fail-closed: a missing configuration, an
 * unrecognised event, or an unauthenticated callback leaves the attempt in a
 * non-verified state. Membership is NEVER activated from client-side input.
 */

import { VerificationOutcome } from "./types";

/** Outcome reported by a provider adapter, normalised for the state machine. */
export interface ProviderVerificationResult {
  status: VerificationOutcome;
  /** Opaque provider-side reference. Never returned to the client. */
  providerReference: string;
  /** How the provider reached its decision (e.g. "instant", "document_review"). */
  method: string;
  /** Raw provider event, redacted before it is persisted. */
  rawEvent?: Record<string, unknown>;
  reviewedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly providerId: string;

  /** Build the redirect URL / launch target for a verification attempt. */
  initiate(input: {
    userId: string;
    collegeId: string;
    attemptId: string;
    programId: string;
    redirectUri: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ redirectUrl: string; providerReference: string }>;

  /**
   * Authoritative status retrieval. The caller (a Cloud Function) never trusts
   * a client-reported status — it calls this to get the truth.
   */
  getStatus(input: {
    attemptId: string;
    providerReference: string;
    programId: string;
  }): Promise<ProviderVerificationResult | null>;

  /**
   * Validate an inbound provider callback/event. Returns the parsed result
   * only if the event authenticates and matches the expected attempt.
   */
  handleCallback(input: {
    rawBody: string;
    signature: string | null;
    attemptId: string;
    providerReference: string;
    programId: string;
  }): Promise<ProviderVerificationResult | null>;
}

// ─── Provider configuration ─────────────────────────────────────────────────

export interface ProviderConfig {
  providerId: string;
  /** collegeId -> provider program id. Admin-controlled, server-side only. */
  programMappings: Record<string, string>;
  /** Server-managed credential. Never exposed to the client. */
  secret: string;
  /** Callback signing secret. Never exposed to the client. */
  webhookSecret?: string;
  statusEndpoint?: string;
  initiateEndpoint?: string;
  timeoutMs?: number;
}
