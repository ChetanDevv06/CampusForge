/**
 * Firebase Emulator Suite tests for the verification service.
 *
 * These tests require the Firestore emulator (and the Auth emulator for the
 * callable-level tests) to be running:
 *
 *   npm --prefix functions run test:emulator
 *
 * They are skipped automatically when FIRESTORE_EMULATOR_HOST is not set, so a
 * plain `npm test` run never fails for want of an emulator.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import * as admin from "firebase-admin";
import {
  VerificationError,
  VerificationService,
} from "../src/verification-service";
import { attemptIdFor, PATHS } from "../src/db";
import type { ProviderAdapter } from "../src/providers";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfEmulator = EMULATOR_HOST ? describe : describe.skip;

const COLLEGE = "rvce";
const OTHER_COLLEGE = "iitb";

/** In-memory fake provider used to exercise the provider path. */
class FakeProviderAdapter implements ProviderAdapter {
  readonly providerId = "fake";
  initiated = 0;

  async initiate(input: {
    collegeId: string;
    attemptId: string;
  }): Promise<{ redirectUrl: string; providerReference: string }> {
    this.initiated += 1;
    expect(input.collegeId).toBe(COLLEGE);
    return {
      redirectUrl: "https://provider.example/verify/session_1",
      providerReference: "ref_session_1",
    };
  }

  async getStatus() {
    return null;
  }

  async handleCallback() {
    return null;
  }
}

async function seed() {
  const db = getDb();
  await db.doc(PATHS.college(COLLEGE)).set({
    name: "RV College of Engineering",
    shortName: "RVCE",
    domain: "rvce.edu.in",
    domains: ["rvce.edu.in"],
    location: "Bengaluru",
    verified: true,
    memberCount: 0,
    verificationEnabled: true,
    verificationProviderId: "fake",
    verificationProgramId: "PROG_RVCE_1",
    verificationMethod: "provider_redirect",
    createdAt: admin.firestore.Timestamp.now(),
  });

  await db.doc(PATHS.college(OTHER_COLLEGE)).set({
    name: "Indian Institute of Technology Bombay",
    shortName: "IIT Bombay",
    domain: "iitb.ac.in",
    domains: ["iitb.ac.in"],
    location: "Mumbai",
    verified: true,
    memberCount: 0,
    verificationEnabled: true,
    verificationProviderId: "fake",
    verificationProgramId: "PROG_IITB_1",
    verificationMethod: "provider_redirect",
    createdAt: admin.firestore.Timestamp.now(),
  });

  // Manual-review-only campus (no provider configured).
  await db.doc(PATHS.college("christ")).set({
    name: "Christ University",
    shortName: "CHRIST",
    domain: "christuniversity.in",
    domains: ["christuniversity.in"],
    location: "Bengaluru",
    verified: true,
    memberCount: 0,
    verificationEnabled: true,
    verificationProviderId: null,
    verificationProgramId: null,
    verificationMethod: "manual_review",
    createdAt: admin.firestore.Timestamp.now(),
  });

  // Closed campus.
  await db.doc(PATHS.college("nitk")).set({
    name: "NIT Karnataka",
    shortName: "NITK",
    domain: "nitk.edu.in",
    domains: ["nitk.edu.in"],
    location: "Surathkal",
    verified: true,
    memberCount: 0,
    verificationEnabled: false,
    verificationProviderId: null,
    verificationProgramId: null,
    verificationMethod: "manual_review",
    createdAt: admin.firestore.Timestamp.now(),
  });

  await db.doc(PATHS.user("student")).set({
    uid: "student",
    name: "Test Student",
    email: "student@example.com",
    collegeId: COLLEGE,
    collegeName: "RV College of Engineering",
    createdAt: admin.firestore.Timestamp.now(),
  });

  await db.doc(PATHS.user("other")).set({
    uid: "other",
    name: "Other Student",
    email: "other@example.com",
    collegeId: OTHER_COLLEGE,
    collegeName: "Indian Institute of Technology Bombay",
    createdAt: admin.firestore.Timestamp.now(),
  });
}

let db: admin.firestore.Firestore;
let service: VerificationService;

function getDb() {
  if (!db) {
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: "demo-campusforge" });
    }
    db = admin.firestore();
  }
  return db;
}

describeIfEmulator("VerificationService against the Firestore emulator", () => {
  beforeAll(async () => {
    db = getDb();
    service = new VerificationService(db);
  });

  afterAll(async () => {
    await db.terminate().catch(() => undefined);
  });

  beforeEach(async () => {
    const collections = await db.listCollections();
    await Promise.all(
      collections.map((collection) =>
        db.recursiveDelete(collection).catch(() => undefined),
      ),
    );
    await seed();
  });

  it("starts a pending attempt with a redirect and grants no access", async () => {
    const adapter = new FakeProviderAdapter();
    const result = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) =>
        adapter.initiate(args),
    });

    expect(result.redirectUrl).toBe("https://provider.example/verify/session_1");
    expect(result.status.status).toBe("pending");
    expect(result.status.hasCampusAccess).toBe(false);

    // The opaque provider reference is stored server-side only.
    const privateSnap = await db.doc(PATHS.verificationPrivate(result.attemptId)).get();
    expect(privateSnap.data()?.providerReference).toBe("ref_session_1");
  });

  it("does not duplicate an in-flight attempt", async () => {
    const adapter = new FakeProviderAdapter();
    const first = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });
    const second = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });
    expect(second.reused).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(adapter.initiated).toBe(1);
  });

  it("activates membership only after a validated approved outcome", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    // Before the provider decision there is no membership at all.
    expect(await service.getMembership("student")).toBeNull();

    const applied = await service.applyProviderOutcome({
      attemptId,
      providerId: "fake",
      providerReference: "ref_session_1",
      providerProgramId: "PROG_RVCE_1",
      outcome: "approved",
      eventId: "evt_approved_1",
    });

    expect(applied.status).toBe("verified");
    expect(applied.applied).toBe(true);

    const membership = (await service.getMembership("student"))!;
    expect(membership.status).toBe("active");
    expect(membership.collegeId).toBe(COLLEGE);
    expect(membership.verificationId).toBe(attemptId);
    expect(membership.expiresAt).not.toBeNull();

    const status = await service.getSafeStatus("student", COLLEGE);
    expect(status.hasCampusAccess).toBe(true);
  });

  it("treats a duplicate provider callback as a no-op (idempotent)", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    await service.applyProviderOutcome({
      attemptId,
      providerId: "fake",
      providerReference: "ref_session_1",
      providerProgramId: "PROG_RVCE_1",
      outcome: "approved",
      eventId: "evt_duplicate",
    });

    const replay = await service.applyProviderOutcome({
      attemptId,
      providerId: "fake",
      providerReference: "ref_session_1",
      providerProgramId: "PROG_RVCE_1",
      outcome: "rejected",
      eventId: "evt_duplicate",
    });

    expect(replay.applied).toBe(false);
    expect(replay.status).toBe("verified");
    // Membership survives the replayed rejection.
    expect((await service.getMembership("student"))?.status).toBe("active");
  });

  it("rejects a callback for a different college's program", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    await expect(
      service.applyProviderOutcome({
        attemptId,
        providerId: "fake",
        providerReference: "ref_session_1",
        providerProgramId: "PROG_IITB_1",
        outcome: "approved",
        eventId: "evt_college_mismatch",
      }),
    ).rejects.toBeInstanceOf(VerificationError);

    expect((await service.getMembership("student"))).toBeNull();
    const status = await service.getSafeStatus("student", COLLEGE);
    expect(status.hasCampusAccess).toBe(false);
  });

  it("rejects a callback whose provider reference does not match", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    await expect(
      service.applyProviderOutcome({
        attemptId,
        providerId: "fake",
        providerReference: "ref_someone_else",
        providerProgramId: "PROG_RVCE_1",
        outcome: "approved",
        eventId: "evt_forged",
      }),
    ).rejects.toThrow(/provider reference/i);
  });

  it("keeps a rejected student restricted and revokes any active membership", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    await service.applyProviderOutcome({
      attemptId,
      providerId: "fake",
      providerReference: "ref_session_1",
      providerProgramId: "PROG_RVCE_1",
      outcome: "approved",
      eventId: "evt_1",
    });
    expect((await service.getMembership("student"))?.status).toBe("active");

    await service.revokeMembership({
      userId: "student",
      action: "suspend",
      adminId: "admin",
      reason: "policy review",
    });

    const status = await service.getSafeStatus("student", COLLEGE);
    expect(status.status).toBe("suspended");
    expect(status.hasCampusAccess).toBe(false);
  });

  it("fails closed when the attempt belongs to a different college", async () => {
    const adapter = new FakeProviderAdapter();
    await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });

    // The user's profile says RVCE but an attempt is started for IIT Bombay.
    await expect(
      service.startAttempt({
        userId: "student",
        collegeId: OTHER_COLLEGE,
        providerProgramId: "PROG_IITB_1",
      }),
    ).rejects.toThrow(/does not match your selected college/i);
  });

  it("refuses to start a verification for a closed campus", async () => {
    await expect(
      service.startAttempt({
        userId: "student",
        collegeId: "nitk",
      }),
    ).rejects.toThrow(/not enabled/i);
  });

  it("queues manual review without a provider redirect", async () => {
    const dbDoc = db.doc(PATHS.user("manual"));
    await dbDoc.set({
      uid: "manual",
      name: "Manual Student",
      email: "manual@example.com",
      collegeId: "christ",
      createdAt: admin.firestore.Timestamp.now(),
    });

    const result = await service.startAttempt({
      userId: "manual",
      collegeId: "christ",
    });

    expect(result.redirectUrl).toBeNull();
    expect(result.status.status).toBe("pending");
    expect(result.status.providerConfigured).toBe(true);
    expect((await service.getMembership("manual"))).toBeNull();
  });

  it("only activates membership through an admin decision", async () => {
    // Use a manual-review campus: no provider flow is involved, so an admin
    // decision is the only path to an active membership.
    await db.doc(PATHS.college(COLLEGE)).set(
      {
        verificationProviderId: null,
        verificationProgramId: null,
        verificationMethod: "manual_review",
      },
      { merge: true },
    );

    const attempt = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
    });
    expect(attempt.status.hasCampusAccess).toBe(false);
    expect(await service.getMembership("student")).toBeNull();

    await service.adjudicate({
      userId: "student",
      collegeId: COLLEGE,
      outcome: "approved",
      adminId: "admin-1",
      reason: "manual review",
    });

    const membership = (await service.getMembership("student"))!;
    expect(membership.status).toBe("active");
    expect(membership.activatedBy).toBe("admin:admin-1");
  });

  it("expires stale attempts", async () => {
    const attemptId = attemptIdFor("student", COLLEGE);
    await db.doc(PATHS.verification(attemptId)).set({
      userId: "student",
      collegeId: COLLEGE,
      providerId: "fake",
      providerProgramId: "PROG_RVCE_1",
      status: "pending",
      method: "provider_redirect",
      policyVersion: "v1",
      attemptCount: 1,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000),
    });

    const expired = await service.expireStaleAttempts();
    expect(expired).toBe(1);

    const status = await service.getSafeStatus("student", COLLEGE);
    expect(status.status).toBe("expired");
    expect(status.nextAction).toBe("retry");
  });

  it("keeps the student's profile when writing a verification status", async () => {
    // Regression: writing the mirrored status with a non-merge set() wiped the
    // whole user document (name, email, collegeId) on every decision.
    await db.doc(PATHS.user("student")).set({
      uid: "student",
      name: "Test Student",
      email: "student@example.com",
      collegeId: COLLEGE,
      rating: 5,
      reviewCount: 2,
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Manual-review campus: the decision path is what we are testing here.
    await db.doc(PATHS.college(COLLEGE)).set(
      {
        verificationProviderId: null,
        verificationProgramId: null,
        verificationMethod: "manual_review",
      },
      { merge: true },
    );

    const attempt = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
    });
    expect(attempt.status.hasCampusAccess).toBe(false);

    await service.adjudicate({
      userId: "student",
      collegeId: COLLEGE,
      outcome: "approved",
      adminId: "admin-1",
      reason: "manual review",
    });

    const profile = (await db.doc(PATHS.user("student")).get()).data()!;
    expect(profile.name).toBe("Test Student");
    expect(profile.email).toBe("student@example.com");
    expect(profile.collegeId).toBe(COLLEGE);
    expect(profile.verificationStatus).toBe("verified");
    expect(profile.accountStatus).toBe("active_member");
    expect(profile.verifiedCollegeId).toBe(COLLEGE);

    // Suspension must preserve the profile too.
    await service.revokeMembership({
      userId: "student",
      action: "suspend",
      adminId: "admin-1",
      reason: "policy review",
    });

    const suspended = (await db.doc(PATHS.user("student")).get()).data()!;
    expect(suspended.name).toBe("Test Student");
    expect(suspended.collegeId).toBe(COLLEGE);
    expect(suspended.verificationStatus).toBe("suspended");
    expect(suspended.accountStatus).toBe("suspended");
  });

  it("writes an audit trail for every transition", async () => {
    const adapter = new FakeProviderAdapter();
    const { attemptId } = await service.startAttempt({
      userId: "student",
      collegeId: COLLEGE,
      providerProgramId: "PROG_RVCE_1",
      initiateProvider: (args) => adapter.initiate(args),
    });
    await service.applyProviderOutcome({
      attemptId,
      providerId: "fake",
      providerReference: "ref_session_1",
      providerProgramId: "PROG_RVCE_1",
      outcome: "approved",
      eventId: "evt_audit",
    });

    const entries = await db
      .doc(PATHS.verification(attemptId))
      .collection("audit")
      .get();

    expect(entries.size).toBeGreaterThanOrEqual(2);
    const reasons = entries.docs.map((doc) => String(doc.data().reason));
    expect(reasons.some((r) => r.includes("attempt_started"))).toBe(true);
    expect(reasons.some((r) => r.includes("provider_outcome"))).toBe(true);
  });

  it("fails closed when the provider adapter is not configured", async () => {
    // RVCE is configured for a provider redirect, but no authenticate-able
    // provider adapter is wired into the backend. Verification must fail
    // closed instead of entering a pending state nobody can resolve.
    await expect(
      service.startAttempt({
        userId: "student",
        collegeId: COLLEGE,
        providerProgramId: "PROG_RVCE_1",
      }),
    ).rejects.toMatchObject({ code: "VERIFICATION_PROVIDER_NOT_CONFIGURED" });

    const attempt = await service.getAttempt("student", COLLEGE);
    expect(attempt?.status ?? "not_started").toBe("not_started");
    expect(await service.getMembership("student")).toBeNull();
  });

  it("fails closed when the provider program cannot be resolved", async () => {
    // The college requests a provider flow but carries no program mapping.
    await db.doc(PATHS.college(COLLEGE)).set(
      { verificationProviderId: "fake", verificationProgramId: null },
      { merge: true },
    );
    await expect(
      service.startAttempt({
        userId: "student",
        collegeId: COLLEGE,
        providerProgramId: null,
        initiateProvider: async () => ({
          redirectUrl: "https://provider.example/x",
          providerReference: "ref_x",
        }),
      }),
    ).rejects.toMatchObject({ code: "VERIFICATION_PROVIDER_NOT_CONFIGURED" });
  });
});
