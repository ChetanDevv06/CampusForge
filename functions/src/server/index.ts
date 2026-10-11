/**
 * Self-hosted HTTP transport for the CampusForge verification backend.
 *
 * This exposes the same operations as the Cloud Functions callables in
 * `src/index.ts`, over plain HTTP, so the backend can run on any Node host
 * (Render, Railway, Fly.io, Cloud Run, a VPS) without a Blaze plan.
 *
 * The verification logic is untouched: every route authenticates a Firebase ID
 * token, delegates to `VerificationService`, and enforces the same rate limits,
 * transitions and authority rules as the callables.
 *
 * Run:
 *   npm --prefix functions run build
 *   PORT=4000 GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node functions/lib/server/index.js
 */

import express, { type Express, type Request, type Response } from "express";
import * as admin from "firebase-admin";
import { getDb } from "../db";
import { VerificationService, VerificationError } from "../verification-service";
import { consumeRateLimit } from "../rate-limit";
import {
  getProviderAdapter,
  isProviderOutcome,
} from "../providers";
import { handleProviderWebhook } from "../provider-webhook";
import {
  authenticate,
  errorBody,
  httpStatusFor,
  requireAdmin,
  type HttpStatus,
} from "./auth";
import type { CollegeConfig } from "../types";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function bootstrap() {
  if (admin.apps.length > 0) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    // Inline JSON, handy on hosts that only expose env vars.
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(serviceAccount) as admin.ServiceAccount,
      ),
    });
    return;
  }

  // GOOGLE_APPLICATION_CREDENTIALS, gcloud's application-default credentials or
  // a metadata server (Cloud Run / GCE) are all picked up by cert-free default.
  admin.initializeApp();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bodyString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function verificationError(error: unknown): {
  status: number;
  body: ReturnType<typeof errorBody>;
} {
  if (error instanceof VerificationError) {
    const httpStatus: HttpStatus =
      error.httpStatus === 401
        ? "unauthenticated"
        : error.httpStatus === 403
          ? "permission-denied"
          : error.httpStatus === 429
            ? "resource-exhausted"
            : error.httpStatus === 503
              ? "unavailable"
              : "failed-precondition";
    return {
      status: httpStatusFor(httpStatus),
      body: errorBody(httpStatus, error.message, error.code),
    };
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { status: 500, body: errorBody("internal", message) };
}

function ok(res: Response, result: Record<string, unknown>) {
  res.status(200).json({ result });
}

/** Builds the provider launcher used by start/retry. */
function initiateProviderFor(college: CollegeConfig | null) {
  if (!college) return undefined;
  const adapter = college.verificationProviderId
    ? getProviderAdapter(college.verificationProviderId)
    : null;
  const programId = college.verificationProgramId;
  if (!adapter || !programId) return undefined;

  return async (input: {
    attemptId: string;
    programId: string;
    collegeId: string;
    userId: string;
  }) => {
    const clientId = `campusforge:${input.attemptId}`;
    return adapter.initiate({
      userId: input.userId,
      collegeId: input.collegeId,
      attemptId: input.attemptId,
      programId: input.programId,
      redirectUri: clientId,
    });
  };
}

async function loadCollege(service: VerificationService, collegeId: string) {
  const college = await service.getCollegeConfig(collegeId);
  if (!college) {
    throw new VerificationError(
      "VERIFICATION_COLLEGE_NOT_FOUND",
      "The selected college is not a configured partner college.",
    );
  }
  return college;
}

async function selectedCollegeId(uid: string): Promise<string | null> {
  const snapshot = await getDb().doc(`users/${uid}`).get();
  return (snapshot.data()?.collegeId as string) ?? null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

function registerRoutes(app: Express) {
  const service = new VerificationService(getDb());

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: "campusforge-verification" });
  });

  // ── startVerification ────────────────────────────────────────────────────────
  app.post("/verify/start", authenticate, async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const collegeId = bodyString(req.body?.collegeId, 120);
    if (!collegeId) {
      res.status(400).json(errorBody("invalid-argument", '"collegeId" is required.'));
      return;
    }

    try {
      const college = await loadCollege(service, collegeId);
      await consumeRateLimit("startVerification", uid, getDb());

      const result = await service.startAttempt({
        userId: uid,
        collegeId,
        providerProgramId: college.verificationProgramId,
        initiateProvider: initiateProviderFor(college),
      });

      ok(res, {
        attemptId: result.attemptId,
        redirectUrl: result.redirectUrl,
        reused: result.reused,
        status: serialise(result.status),
      });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  });

  // ── getVerificationStatus ────────────────────────────────────────────────────
  app.post("/verify/status", authenticate, async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    try {
      await consumeRateLimit("getVerificationStatus", uid, getDb());
      const requested = bodyString(req.body?.collegeId, 120);
      const collegeId = requested ?? (await selectedCollegeId(uid));
      ok(res, { status: serialise(await service.getSafeStatus(uid, collegeId)) });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  });

  // ── retryVerification ────────────────────────────────────────────────────────
  app.post("/verify/retry", authenticate, async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const collegeId = bodyString(req.body?.collegeId, 120);
    if (!collegeId) {
      res.status(400).json(errorBody("invalid-argument", '"collegeId" is required.'));
      return;
    }

    try {
      await consumeRateLimit("retryVerification", uid, getDb());
      const college = await loadCollege(service, collegeId);

      const result = await service.retryAttempt({
        userId: uid,
        collegeId,
        providerProgramId: college.verificationProgramId,
        initiateProvider: initiateProviderFor(college),
      });
      ok(res, {
        attemptId: result.attemptId,
        redirectUrl: result.redirectUrl,
        status: serialise(result.status),
      });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  });

  // ── cancelVerification ───────────────────────────────────────────────────────
  app.post("/verify/cancel", authenticate, async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const collegeId = bodyString(req.body?.collegeId, 120);
    if (!collegeId) {
      res.status(400).json(errorBody("invalid-argument", '"collegeId" is required.'));
      return;
    }
    try {
      await consumeRateLimit("cancelVerification", uid, getDb());
      await service.cancelAttempt({ userId: uid, collegeId });
      ok(res, { ok: true });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  });

  // ── submitAppeal ─────────────────────────────────────────────────────────────
  app.post("/verify/appeal", authenticate, async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const collegeId = bodyString(req.body?.collegeId, 120);
    const reason = bodyString(req.body?.reason, 2000);
    if (!collegeId || !reason) {
      res
        .status(400)
        .json(errorBody("invalid-argument", '"collegeId" and "reason" are required.'));
      return;
    }

    try {
      await consumeRateLimit("submitAppeal", uid, getDb());
      const result = await service.submitAppeal({ userId: uid, collegeId, reason });
      ok(res, {
        appealId: result.appealId,
        attemptId: result.attemptId,
        status: serialise(result.status),
      });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  });

  // ── adjudicateVerification (admin) ───────────────────────────────────────────
  app.post(
    "/verify/adjudicate",
    authenticate,
    requireAdmin,
    async (req: Request, res: Response) => {
      const adminUid = req.auth!.uid;
      const userId = bodyString(req.body?.userId, 120);
      const collegeId = bodyString(req.body?.collegeId, 120);
      const outcome = bodyString(req.body?.outcome, 40);
      const reason = bodyString(req.body?.reason, 2000);

      if (!userId || !collegeId || !outcome || !reason) {
        res
          .status(400)
          .json(
            errorBody(
              "invalid-argument",
              '"userId", "collegeId", "outcome" and "reason" are required.',
            ),
          );
        return;
      }
      if (!isProviderOutcome(outcome)) {
        res
          .status(400)
          .json(
            errorBody(
              "invalid-argument",
              "outcome must be approved | rejected | inconclusive | needs_action",
            ),
          );
        return;
      }

      try {
        await consumeRateLimit("adjudicateVerification", adminUid, getDb());
        const result = await service.adjudicate({
          userId,
          collegeId,
          outcome,
          adminId: adminUid,
          reason,
        });
        ok(res, { status: result.status });
      } catch (error) {
        const { status, body } = verificationError(error);
        res.status(status).json(body);
      }
    },
  );

  // ── revokeMembership (admin) ─────────────────────────────────────────────────
  app.post(
    "/verify/revoke",
    authenticate,
    requireAdmin,
    async (req: Request, res: Response) => {
      const adminUid = req.auth!.uid;
      const userId = bodyString(req.body?.userId, 120);
      const action = bodyString(req.body?.action, 20);
      const reason = bodyString(req.body?.reason, 2000);

      if (!userId || !action || !reason) {
        res
          .status(400)
          .json(
            errorBody(
              "invalid-argument",
              '"userId", "action" and "reason" are required.',
            ),
          );
        return;
      }
      if (!["suspend", "revoke", "expire", "reinstate"].includes(action)) {
        res
          .status(400)
          .json(
            errorBody(
              "invalid-argument",
              "action must be suspend | revoke | expire | reinstate",
            ),
          );
        return;
      }

      try {
        await service.revokeMembership({
          userId,
          action: action as "suspend" | "revoke" | "expire" | "reinstate",
          adminId: adminUid,
          reason,
        });
        ok(res, { ok: true });
      } catch (error) {
        const { status, body } = verificationError(error);
        res.status(status).json(body);
      }
    },
  );

  // ── expireVerifications (admin + daily timer) ──────────────────────────────
  const runExpiry = async (res: Response) => {
    try {
      const expired = await service.expireStaleAttempts();
      ok(res, { expired });
    } catch (error) {
      const { status, body } = verificationError(error);
      res.status(status).json(body);
    }
  };

  app.post(
    "/verify/expire",
    authenticate,
    requireAdmin,
    async (_req: Request, res: Response) => {
      await runExpiry(res);
    },
  );

  // ── provider webhook ────────────────────────────────────────────────────────
  app.post(
    "/verify/callback",
    express.raw({ type: "*/*", limit: "1mb" }),
    async (req: Request, res: Response) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      const providerId =
        (typeof req.query.provider === "string" ? req.query.provider : undefined) ??
        (req.headers["x-campusforge-provider"] as string | undefined) ??
        "";

      const result = await handleProviderWebhook(
        { providerId, rawBody, headers: req.headers },
        getDb(),
        (message, context) => console.warn(message, context),
      );
      res.status(result.status).json(result.body);
    },
  );
}

// ── Serialisation ─────────────────────────────────────────────────────────────

/** Dates must be JSON-safe; convert them to ISO strings like the callables do. */
function serialise(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const key of Object.keys(out)) {
    const current = out[key];
    if (current instanceof Date) out[key] = current.toISOString();
    else if (current && typeof current === "object" && !Array.isArray(current)) {
      out[key] = serialise(current as Record<string, unknown>);
    }
  }
  return out;
}

// ── Entry point ───────────────────────────────────────────────────────────────

function start() {
  bootstrap();
  const app: Express = express();
  app.use(express.json({ limit: "256kb" }));
  registerRoutes(app);

  // Daily expiry sweep. Also callable on demand via POST /verify/expire (admin),
  // which matters on hosts that scale to zero between requests.
  const timer: ReturnType<typeof setInterval> = setInterval(() => {
    new VerificationService(getDb())
      .expireStaleAttempts()
      .then((expired) => console.log("expireVerifications completed", { expired }))
      .catch((error) => console.warn("expireVerifications failed", error));
  }, 24 * 60 * 60 * 1000);
  // Keep the process from being held open by the timer alone.
  (timer as { unref?: () => void }).unref?.();

  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => {
    console.log(`CampusForge verification backend listening on :${port}`);
  });
}

// Only listen when executed directly, so tests can import the app safely.
if (require.main === module) {
  start();
}

export { start, registerRoutes, serialise };
