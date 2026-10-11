/**
 * CampusForge trusted backend — verification lifecycle.
 *
 * Naming follows the existing codebase conventions (camelCase callables).
 *
 * Exported callables:
 *   startVerification     — begin/resume an attempt for the selected college
 *   getVerificationStatus — safe, own-user status projection
 *   retryVerification     — start a new attempt after a failure/expiry
 *   cancelVerification    — abandon an in-flight attempt
 *   submitAppeal          — appeal a rejected decision
 *   adjudicateVerification (admin) — human review decision
 *   revokeMembership      (admin) — suspend / revoke / expire / reinstate
 *
 * Exported HTTP / scheduled:
 *   handleProviderCallback — provider webhook (signature-verified)
 *   expireVerifications    — nightly expiry sweep
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { getDb } from "./db";
import {
  VerificationError,
  VerificationService,
} from "./verification-service";
import { getProviderAdapter, isProviderOutcome } from "./providers";
import { consumeRateLimit, RateLimitError } from "./rate-limit";
import { handleProviderWebhook } from "./provider-webhook";

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// ── Shared helpers ────────────────────────────────────────────────────────────

function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  return auth.uid;
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof RateLimitError) {
    return new HttpsError("resource-exhausted", error.message, {
      retryAfterSeconds: Math.ceil(error.retryAfterMs / 1000),
    });
  }
  if (error instanceof VerificationError) {
    const code =
      error.httpStatus === 401
        ? "unauthenticated"
        : error.httpStatus === 403
          ? "permission-denied"
          : error.httpStatus === 429
            ? "resource-exhausted"
            : error.httpStatus === 503
              ? "unavailable"
              : "failed-precondition";
    return new HttpsError(code, error.message, { verificationCode: error.code });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return new HttpsError("internal", message);
}

function assertString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `"${field}" is required.`);
  }
  if (value.length > max) {
    throw new HttpsError("invalid-argument", `"${field}" is too long.`);
  }
  return value.trim();
}

async function assertAdmin(uid: string): Promise<void> {
  const user = await getAuth().getUser(uid);
  const isAdmin = user.customClaims?.admin === true;
  if (isAdmin) return;

  const profile = await getDb().doc(`users/${uid}`).get();
  if (profile.data()?.role === "admin") return;

  throw new HttpsError("permission-denied", "Administrator access required.");
}

// ── Callables ──────────────────────────────────────────────────────────────────

export const startVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const service = new VerificationService(getDb());

  try {
    const collegeId = assertString(request.data?.collegeId, "collegeId", 120);

    // The college is resolved server-side; any provider program id in the
    // payload is ignored so the client cannot point at another program.
    const college = await service.getCollegeConfig(collegeId);
    if (!college) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_NOT_FOUND",
        "The selected college is not a configured partner college.",
      );
    }

    await consumeRateLimit("startVerification", uid);

    const providerId = college.verificationProviderId;
    const programId = college.verificationProgramId;
    const adapter = providerId ? getProviderAdapter(providerId) : null;

    const result = await service.startAttempt({
      userId: uid,
      collegeId,
      providerProgramId: programId,
      initiateProvider:
        adapter && programId
          ? async ({ attemptId, programId: program, collegeId: college, userId }) => {
              const clientId = `campusforge:${attemptId}`;
              const initiated = await adapter.initiate({
                userId,
                collegeId: college,
                attemptId,
                programId: program,
                redirectUri: clientId,
              });
              // Persist the opaque provider reference server-side only.
              await getDb()
                .doc(`verifications/${attemptId}/private/provider`)
                .set(
                  { providerReference: initiated.providerReference },
                  { merge: true },
                );
              return initiated;
            }
          : undefined,
    });

    return {
      attemptId: result.attemptId,
      redirectUrl: result.redirectUrl,
      reused: result.reused,
      status: serialiseStatus(result.status),
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const getVerificationStatus = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    const service = new VerificationService(getDb());
    const collegeId =
      typeof request.data?.collegeId === "string" && request.data.collegeId
        ? request.data.collegeId
        : null;

    let effectiveCollegeId: string | null = collegeId;
    if (!effectiveCollegeId) {
      const profile = await getDb().doc(`users/${uid}`).get();
      effectiveCollegeId = (profile.data()?.collegeId as string) ?? null;
    }

    return {
      status: serialiseStatus(
        await service.getSafeStatus(uid, effectiveCollegeId),
      ),
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const retryVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    const collegeId = assertString(request.data?.collegeId, "collegeId", 120);
    await consumeRateLimit("retryVerification", uid);

    const service = new VerificationService(getDb());
    const college = await service.getCollegeConfig(collegeId);
    if (!college) {
      throw new VerificationError(
        "VERIFICATION_COLLEGE_NOT_FOUND",
        "The selected college is not a configured partner college.",
      );
    }

    const providerId = college.verificationProviderId;
    const programId = college.verificationProgramId;
    const adapter = providerId ? getProviderAdapter(providerId) : null;

    const result = await service.retryAttempt({
      userId: uid,
      collegeId,
      providerProgramId: programId,
      initiateProvider:
        adapter && programId
          ? async ({ attemptId, programId: program, collegeId: college, userId }) => {
              const initiated = await adapter.initiate({
                userId,
                collegeId: college,
                attemptId,
                programId: program,
                redirectUri: `campusforge:${attemptId}`,
              });
              await getDb()
                .doc(`verifications/${attemptId}/private/provider`)
                .set(
                  { providerReference: initiated.providerReference },
                  { merge: true },
                );
              return initiated;
            }
          : undefined,
    });

    return {
      attemptId: result.attemptId,
      redirectUrl: result.redirectUrl,
      status: serialiseStatus(result.status),
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const cancelVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    const collegeId = assertString(request.data?.collegeId, "collegeId", 120);
    await new VerificationService(getDb()).cancelAttempt({
      userId: uid,
      collegeId,
    });
    return { ok: true };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const submitAppeal = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    const collegeId = assertString(request.data?.collegeId, "collegeId", 120);
    const reason = assertString(request.data?.reason, "reason", 2000);
    await consumeRateLimit("submitAppeal", uid);

    const service = new VerificationService(getDb());
    const result = await service.submitAppeal({ userId: uid, collegeId, reason });
    return {
      appealId: result.appealId,
      attemptId: result.attemptId,
      status: serialiseStatus(result.status),
    };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const adjudicateVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    await assertAdmin(uid);
    const userId = assertString(request.data?.userId, "userId", 120);
    const collegeId = assertString(request.data?.collegeId, "collegeId", 120);
    const rawOutcome = assertString(request.data?.outcome, "outcome", 40);
    const reason = assertString(request.data?.reason, "reason", 2000);

    if (!isProviderOutcome(rawOutcome)) {
      throw new HttpsError(
        "invalid-argument",
        "outcome must be one of approved | rejected | inconclusive | needs_action",
      );
    }

    const result = await new VerificationService(getDb()).adjudicate({
      userId,
      collegeId,
      outcome: rawOutcome,
      adminId: uid,
      reason,
    });
    return { status: result.status };
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const revokeMembership = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  try {
    await assertAdmin(uid);
    const userId = assertString(request.data?.userId, "userId", 120);
    const action = assertString(request.data?.action, "action", 20);
    const reason = assertString(request.data?.reason, "reason", 2000);

    if (!["suspend", "revoke", "expire", "reinstate"].includes(action)) {
      throw new HttpsError(
        "invalid-argument",
        "action must be suspend | revoke | expire | reinstate",
      );
    }

    await new VerificationService(getDb()).revokeMembership({
      userId,
      action: action as "suspend" | "revoke" | "expire" | "reinstate",
      adminId: uid,
      reason,
    });
    return { ok: true };
  } catch (error) {
    throw toHttpsError(error);
  }
});

// ── Provider webhook ─────────────────────────────────────────────────────────

/**
 * Provider callback.
 *
 * The provider reference -> attempt mapping is discovered from the *server-side*
 * private subcollection, so an attacker cannot address an arbitrary attempt by
 * guessing an attempt id. Signature is verified before anything is parsed.
 *
 * The logic lives in `provider-webhook.ts` so the self-hosted HTTP transport
 * enforces exactly the same checks.
 */
export const handleProviderCallback = onRequest(
  { cors: false, invoker: "public" },
  async (req, res) => {
  const rawBody = req.rawBody?.toString("utf8") ?? "";
  const providerId =
    typeof req.query.provider === "string"
      ? req.query.provider
      : (req.headers["x-campusforge-provider"] as string | undefined) ?? "";

  if (!providerId) {
    res.status(400).json({ error: "provider_missing" });
    return;
  }

  const result = await handleProviderWebhook(
    { providerId, rawBody, headers: req.headers },
    getDb(),
    (message, context) => console.warn(message, context),
  );
  res.status(result.status).json(result.body);
  },
);

// ── Scheduled expiry ───────────────────────────────────────────────────────────

export const expireVerifications = onSchedule(
  { schedule: "every day 03:00", timeZone: "UTC" },
  async () => {
    const expired = await new VerificationService(getDb()).expireStaleAttempts();
    console.log("expireVerifications completed", { expired });
  },
);

// ── Serialisation ────────────────────────────────────────────────────────────

/** Callable functions must return JSON-safe values; convert Date → ISO string. */
function serialiseStatus(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const key of Object.keys(out)) {
    const current = out[key];
    if (current instanceof Date) out[key] = current.toISOString();
    else if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = serialiseStatus(current as Record<string, unknown>);
    }
  }
  return out;
}
