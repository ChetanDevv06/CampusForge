/**
 * Firestore Security Rules tests, executed against the Firestore emulator.
 *
 * Run with:
 *   npm --prefix functions run test:emulator
 * (or: firebase emulators:exec --only firestore --project demo-campusforge "vitest run tests/firestore.rules.test.ts")
 *
 * These tests are skipped automatically when FIRESTORE_EMULATOR_HOST is unset.
 */

import { serverTimestamp } from "@firebase/firestore";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfEmulator = EMULATOR_HOST ? describe : describe.skip;

const COLLEGE = "rvce";
const projectId = "demo-campusforge";

let env: RulesTestEnvironment;

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`colleges/${COLLEGE}`).set({
      name: "RV College of Engineering",
      shortName: "RVCE",
      domain: "rvce.edu.in",
      domains: ["rvce.edu.in"],
      location: "Bengaluru",
      verified: true,
      memberCount: 0,
      verificationEnabled: true,
      verificationProviderId: null,
      verificationProgramId: null,
      verificationMethod: "manual_review",
    });

    const now = new Date();
    await db.doc("users/verified_user").set({
      uid: "verified_user",
      name: "Verified",
      email: "verified@example.com",
      collegeId: COLLEGE,
      role: "user",
      createdAt: now,
      verificationStatus: "verified",
    });

    await db.doc("users/unverified_user").set({
      uid: "unverified_user",
      name: "Unverified",
      email: "unverified@example.com",
      collegeId: COLLEGE,
      role: "user",
      createdAt: now,
      verificationStatus: "not_started",
    });

    // A student whose verification attempt is already open.
    await db.doc("users/pending_user").set({
      uid: "pending_user",
      name: "Pending",
      email: "pending@example.com",
      collegeId: COLLEGE,
      role: "user",
      createdAt: now,
      verificationStatus: "pending",
    });

    await db.doc("users/admin_user").set({
      uid: "admin_user",
      name: "Admin",
      email: "admin@example.com",
      collegeId: COLLEGE,
      role: "admin",
      createdAt: now,
    });

    // Membership only exists for the verified user (written by the backend).
    await db.doc("memberships/verified_user").set({
      userId: "verified_user",
      collegeId: COLLEGE,
      status: "active",
      verificationId: "verified_user:rvce",
      policyVersion: "v1",
      method: "provider",
      activatedAt: now,
      activatedBy: "provider:fake",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await db.doc(`lost_found/item1`).set({
      userId: "verified_user",
      collegeId: COLLEGE,
      type: "lost",
      status: "active",
      description: "A lost water bottle",
      createdAt: now,
    });

    await db.doc(`marketplace/listing1`).set({
      userId: "verified_user",
      collegeId: COLLEGE,
      status: "active",
      price: 100,
      description: "Calculator",
      createdAt: now,
    });

    await db.doc(`skills/skill1`).set({
      userId: "verified_user",
      collegeId: COLLEGE,
      status: "active",
      maxParticipants: 5,
      currentParticipants: 0,
      description: "Guitar lessons",
      createdAt: now,
    });

    // A verification attempt owned by the unverified user.
    await db.doc("verifications/unverified_user:rvce").set({
      userId: "unverified_user",
      collegeId: COLLEGE,
      status: "pending",
      method: "manual_review",
      policyVersion: "v1",
      attemptCount: 1,
      createdAt: now,
    });
  });
}

describeIfEmulator("firestore.rules — verification enforcement", () => {
  beforeAll(async () => {
    const rules = readFileSync(
      resolve(__dirname, "../../firestore.rules"),
      "utf8",
    );
    const [host, port] = (EMULATOR_HOST as string).split(":");
    env = await initializeTestEnvironment({
      projectId,
      firestore: { host, port: Number(port), rules },
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed();
  });

  // ── Verification documents ──────────────────────────────────────────────

  it("lets a user read their own verification attempt", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertSucceeds(db.doc("verifications/unverified_user:rvce").get());
  });

  it("prevents reading another user's verification attempt", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(db.doc("verifications/unverified_user:rvce").get());
  });

  it("prevents a client from writing its own verification status", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc("verifications/unverified_user:rvce").update({
        status: "verified",
      }),
    );
  });

  it("prevents a client from creating a verification attempt", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(
      db.doc("verifications/verified_user:rvce").set({
        userId: "verified_user",
        collegeId: COLLEGE,
        status: "verified",
      }),
    );
  });

  it("prevents access to provider-private verification data", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc("verifications/unverified_user:rvce/private/provider").get(),
    );
  });

  // ── Membership documents ────────────────────────────────────────────────

  it("lets a user read their own membership", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertSucceeds(db.doc("memberships/verified_user").get());
  });

  it("prevents a client from granting itself a membership", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc("memberships/unverified_user").set({
        userId: "unverified_user",
        collegeId: COLLEGE,
        status: "active",
      }),
    );
  });

  it("prevents a verified user from revoking its own membership", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(
      db.doc("memberships/verified_user").update({ status: "revoked" }),
    );
  });

  it("prevents deleting a membership", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(db.doc("memberships/verified_user").delete());
  });

  // ── College-restricted data ─────────────────────────────────────────────

  it("lets an active member read college content", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertSucceeds(db.doc("lost_found/item1").get());
    await assertSucceeds(db.doc("marketplace/listing1").get());
    await assertSucceeds(db.doc("skills/skill1").get());
  });

  it("blocks an unverified user from reading college content", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(db.doc("lost_found/item1").get());
    await assertFails(db.doc("marketplace/listing1").get());
    await assertFails(db.doc("skills/skill1").get());
  });

  it("blocks an unverified user from querying college content", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.collection("lost_found").where("collegeId", "==", COLLEGE).get(),
    );
    await assertFails(db.collection("marketplace").limit(10).get());
  });

  it("blocks an unverified user from creating college content", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.collection("lost_found").add({
        userId: "unverified_user",
        collegeId: COLLEGE,
        type: "lost",
        status: "active",
        description: "Bottle",
        createdAt: new Date(),
      }),
    );
    await assertFails(
      db.collection("marketplace").add({
        userId: "unverified_user",
        collegeId: COLLEGE,
        status: "active",
        price: 10,
        description: "Book",
        createdAt: new Date(),
      }),
    );
    await assertFails(
      db.collection("skills").add({
        userId: "unverified_user",
        collegeId: COLLEGE,
        status: "active",
        maxParticipants: 3,
        currentParticipants: 0,
        createdAt: new Date(),
      }),
    );
  });

  it("blocks an unverified user from creating chats and messages", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.collection("chats").add({
        participants: ["unverified_user", "verified_user"],
        createdAt: new Date(),
      }),
    );
  });

  it("lets an active member create college content", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    // `serverTimestamp()` is resolved server-side, which is what the
    // `createdAt == request.time` invariant in the rules expects.
    await assertSucceeds(
      db.collection("lost_found").add({
        userId: "verified_user",
        collegeId: COLLEGE,
        type: "lost",
        status: "active",
        description: "ID card",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("lets a user create their own profile at signup", async () => {
    const db = env.authenticatedContext("new_user").firestore();
    await assertSucceeds(
      db.doc("users/new_user").set({
        uid: "new_user",
        name: "New Student",
        email: "new@example.com",
        collegeId: COLLEGE,
        collegeName: "RV College of Engineering",
        avatarUrl: null,
        rating: 5,
        reviewCount: 0,
        hasSeenOnboarding: false,
        createdAt: serverTimestamp(),
        skillsOffered: [],
        skillsRequested: [],
      }),
    );
  });

  it("blocks creating a profile with backend-owned fields", async () => {
    const db = env.authenticatedContext("new_user").firestore();
    await assertFails(
      db.doc("users/new_user").set({
        uid: "new_user",
        name: "New Student",
        email: "new@example.com",
        collegeId: COLLEGE,
        verificationStatus: "verified",
        accountStatus: "active_member",
        role: "admin",
        createdAt: serverTimestamp(),
      }),
    );
  });

  // ── User profile protection ─────────────────────────────────────────────

  it("prevents a user from writing backend-owned verification fields", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc("users/unverified_user").update({
        verificationStatus: "verified",
        accountStatus: "active_member",
        verifiedCollegeId: COLLEGE,
        membershipStatus: "active",
      }),
    );
  });

  it("prevents a user from promoting itself to admin", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc("users/unverified_user").update({ role: "admin" }),
    );
  });

  it("allows a user to change college before any verification exists", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    // verificationStatus is not_started here, so college selection is allowed.
    await assertSucceeds(
      db.doc("users/unverified_user").update({
        collegeId: "iitb",
        collegeName: "IIT Bombay",
        collegeShortName: "IIT Bombay",
      }),
    );
  });

  it("allows ordinary self-service profile updates", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertSucceeds(
      db.doc("users/verified_user").update({
        name: "Verified Student",
        bio: "Hello",
        hasSeenOnboarding: true,
        online: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows selecting a college together with the campus email", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertSucceeds(
      db.doc("users/unverified_user").update({
        collegeId: "iitb",
        collegeName: "IIT Bombay",
        collegeShortName: "IIT Bombay",
        collegeEmail: "student@iitb.ac.in",
        collegeEmailVerified: false,
      }),
    );
  });

  it("blocks college switching once a verification attempt is open", async () => {
    const db = env.authenticatedContext("pending_user").firestore();
    // The backend has mirrored an open attempt onto the profile, so the
    // selected college (and therefore the verification) is locked.
    await assertFails(
      db.doc("users/pending_user").update({ collegeId: "iitb" }),
    );
  });

  it("blocks college switching once a membership is active", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(
      db.doc("users/verified_user").update({ collegeId: "iitb" }),
    );
  });

  it("blocks a user from reading another user's profile", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(db.doc("users/verified_user").get());
  });

  // ── College configuration ───────────────────────────────────────────────

  it("prevents a client from writing provider program ids", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertFails(
      db.doc(`colleges/${COLLEGE}`).update({
        verificationProgramId: "ATTACKER_PROGRAM",
      }),
    );
  });

  it("lets a signed-in user read partner colleges", async () => {
    const db = env.authenticatedContext("unverified_user").firestore();
    await assertSucceeds(db.doc(`colleges/${COLLEGE}`).get());
  });

  // ── Audit & rate limits ─────────────────────────────────────────────────

  it("keeps the audit trail admin-only", async () => {
    const memberDb = env.authenticatedContext("verified_user").firestore();
    await assertFails(memberDb.collection("verification_audit").get());

    const adminDb = env.authenticatedContext("admin_user").firestore();
    await assertSucceeds(adminDb.collection("verification_audit").limit(1).get());
  });

  it("blocks all client access to rate limit counters", async () => {
    const db = env.authenticatedContext("verified_user").firestore();
    await assertFails(db.doc("rate_limits/startVerification:verified_user").get());
  });

  // ── Admin capabilities ──────────────────────────────────────────────────

  it("lets an admin read verification attempts", async () => {
    const db = env.authenticatedContext("admin_user").firestore();
    await assertSucceeds(db.doc("verifications/unverified_user:rvce").get());
  });

  it("denies everything to anonymous users", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc(`colleges/${COLLEGE}`).get());
    await assertFails(db.doc("lost_found/item1").get());
  });
});
