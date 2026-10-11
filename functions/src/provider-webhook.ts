/**
 * Shared provider-webhook handler.
 *
 * Used unchanged by both transports:
 *   - functions/src/index.ts          (Firebase Cloud Functions, if you upgrade later)
 *   - functions/src/server/index.ts   (self-hosted HTTP transport)
 *
 * Keeping one implementation means the signature checks, idempotency and
 * membership rules are identical wherever the backend runs.
 */

import type { Firestore } from "firebase-admin/firestore";
import { VerificationService, VerificationError } from "./verification-service";
import { isProviderOutcome, loadProviderConfigs } from "./providers";
import { consumeRateLimit, RateLimitError } from "./rate-limit";
import { verifyCallbackAuth } from "./callback-auth";
import type { VerificationOutcome } from "./types";

export interface WebhookRequest {
  /** Provider id, resolved from a query parameter or header by the caller. */
  providerId: string;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handleProviderWebhook(
  request: WebhookRequest,
  db: Firestore,
  log: (message: string, context?: unknown) => void = () => {},
): Promise<WebhookResponse> {
  const { providerId, rawBody, headers } = request;

  const providerConfig = loadProviderConfigs().find(
    (c) => c.providerId === providerId,
  );
  if (!providerConfig) {
    // Never acknowledge a callback for an unconfigured provider.
    return { status: 404, body: { error: "provider_unknown" } };
  }

  const auth = verifyCallbackAuth({
    config: {
      mode: providerConfig.webhookSecret ? "hmac" : "none",
      webhookSecret: providerConfig.webhookSecret,
      bearerToken: providerConfig.secret,
      toleranceSeconds: 300,
    },
    rawBody,
    headers,
  });

  if (!auth.ok) {
    // Log only the reason — never the payload, which can contain identity data.
    log("provider_callback_rejected", { providerId, reason: auth.reason });
    return { status: 401, body: { error: "invalid_signature" } };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { status: 400, body: { error: "invalid_body" } };
  }

  const providerReference =
    (payload.referenceId as string) ??
    (payload.providerReference as string) ??
    (payload.requestId as string) ??
    null;
  const eventId = (payload.eventId as string) ?? (payload.id as string) ?? null;
  const rawOutcome = (payload.status as string) ?? (payload.outcome as string) ?? null;

  if (!providerReference || !rawOutcome || !isProviderOutcome(rawOutcome)) {
    return { status: 400, body: { error: "invalid_event" } };
  }

  try {
    await consumeRateLimit("providerCallback", providerReference, db);
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Back-pressure: let the provider retry later instead of failing hard.
      return { status: 429, body: { error: "rate_limited" } };
    }
    throw error;
  }

  const service = new VerificationService(db);

  // The attempt is located by its server-stored provider reference, so a
  // caller can never tell the backend which attempt an event belongs to.
  const match = await db
    .collection("verifications")
    .where("providerId", "==", providerId)
    .limit(200)
    .get();

  let attemptId: string | null = null;
  for (const doc of match.docs) {
    const privateSnap = await db.doc(`verifications/${doc.id}/private/provider`).get();
    if (privateSnap.data()?.providerReference === providerReference) {
      attemptId = doc.id;
      break;
    }
  }

  if (!attemptId) {
    log("provider_callback_unmatched", { providerId });
    return { status: 404, body: { error: "attempt_not_found" } };
  }

  try {
    const result = await service.applyProviderOutcome({
      attemptId,
      providerId,
      providerReference,
      providerProgramId:
        (match.docs.find((d) => d.id === attemptId)?.data().providerProgramId as string) ??
        "",
      outcome: rawOutcome as VerificationOutcome,
      eventId,
      reason: "provider_webhook",
      payload,
    });
    return { status: 200, body: { applied: result.applied, status: result.status } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "processing_error";
    log("provider_callback_error", { providerId, message });
    return {
      status: error instanceof VerificationError ? 422 : 500,
      body: { error: message },
    };
  }
}
