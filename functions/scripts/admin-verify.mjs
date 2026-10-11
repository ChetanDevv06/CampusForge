#!/usr/bin/env node
/**
 * CampusForge admin tool for the interim (manual-review) verification path.
 *
 * There is deliberately no provider integration yet, so a human approves each
 * student. This script talks to the DEPLOYED Cloud Functions using the same
 * authentication and authorisation rules as the mobile app, so it can never
 * grant more access than the backend allows.
 *
 * Prerequisites (once):
 *   1. Firebase console -> Project settings -> Service accounts
 *      -> Generate new private key. Save the JSON OUTSIDE the repository.
 *   2. Point GOOGLE_APPLICATION_CREDENTIALS at it:
 *        Windows:  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\campusloop-admin.json"
 *        macOS:    export GOOGLE_APPLICATION_CREDENTIALS=~/keys/campusloop-admin.json
 *   3. Deploy the functions:  firebase deploy --only functions
 *   4. Grant the first admin:
 *        node functions/scripts/admin-verify.mjs --grant-admin <your-uid>
 *
 * Usage (invoke node directly; `npm run` mangles `--` flags on Windows):
 *   node functions/scripts/admin-verify.mjs --grant-admin <uid>
 *   node functions/scripts/admin-verify.mjs --list
 *   node functions/scripts/admin-verify.mjs <student-uid> <collegeId> <outcome> "<reason>"
 *
 *   outcome = approved | rejected | inconclusive | needs_action
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const OUTCOMES = ["approved", "rejected", "inconclusive", "needs_action"];

// ── .env (API key / project id are only needed for the token exchange) ───────

function findEnvFile() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadEnv() {
  const envPath = findEnvFile();
  if (!envPath) return;
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Older Node without process.loadEnvFile — fall back to a manual parse.
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || "us-central1";

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function ensureCredentials() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    fail(
      "GOOGLE_APPLICATION_CREDENTIALS is not set.\n" +
      "  Download a service-account key from Firebase console -> Project settings\n" +
      "  -> Service accounts, then set that variable to the file path.",
    );
  }
  if (!API_KEY) fail("EXPO_PUBLIC_FIREBASE_API_KEY is missing from .env");
  if (!PROJECT_ID) fail("EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing from .env");
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

/** Mint an ID token for a uid that already has the admin custom claim. */
async function mintIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.idToken) {
    fail(
      `Could not exchange the custom token: ${body?.error?.message || response.status}`,
    );
  }
  return body.idToken;
}

async function isAdmin(uid) {
  const user = await admin.auth().getUser(uid);
  return user.customClaims?.admin === true;
}

/** Call a deployed callable exactly like the mobile app does. */
async function callFunction(name, idToken, data) {
  const response = await fetch(
    `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(
      `${name} failed (${response.status}): ${JSON.stringify(body?.error || body)}`,
    );
  }
  return body.result ?? {};
}

// ── Commands ────────────────────────────────────────────────────────────────

async function grantAdmin(uid) {
  ensureCredentials();
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`\n  Admin claim granted to ${uid}. Sign in again in the app.\n`);
}

async function listPending() {
  ensureCredentials();
  const db = admin.firestore();
  const snapshot = await db
    .collection("verifications")
    .where("status", "in", ["pending", "needs_action"])
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  if (snapshot.empty) {
    console.log("\n  No pending verification attempts.\n");
    return;
  }
  console.log("\n  Pending verification attempts:\n");
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(
      `    ${doc.id}  ${data.status}  attempts=${data.attemptCount ?? 1}`,
    );
  }
  console.log(
    "\n  Approve with: node scripts/admin-verify.mjs <student-uid> <collegeId> approved \"reason\"\n",
  );
}

async function adjudicate(adminUid, studentUid, collegeId, outcome, reason) {
  ensureCredentials();
  if (!OUTCOMES.includes(outcome)) {
    fail(`outcome must be one of: ${OUTCOMES.join(", ")}`);
  }
  if (!(await isAdmin(adminUid))) {
    fail(
      `${adminUid} is not an admin. Run:\n` +
      `  node scripts/admin-verify.mjs --grant-admin ${adminUid}`,
    );
  }
  const idToken = await mintIdToken(adminUid);
  const result = await callFunction("adjudicateVerification", idToken, {
    userId: studentUid,
    collegeId,
    outcome,
    reason,
  });
  console.log(`\n  Verification for ${studentUid} is now "${result.status}".\n`);
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  // Drop the leading `--` npm adds before passthrough arguments.
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      [
        "",
        "  CampusForge admin verification tool",
        "",
        "  node functions/scripts/admin-verify.mjs --grant-admin <uid>",
        "  node functions/scripts/admin-verify.mjs --list",
        "  node functions/scripts/admin-verify.mjs <student-uid> <collegeId> <outcome> \"<reason>\"",
        "",
        "  outcome: approved | rejected | inconclusive | needs_action",
        "",
      ].join("\n"),
    );
    return;
  }

  if (args[0] === "--grant-admin") {
    if (!args[1]) fail("Usage: --grant-admin <uid>");
    await grantAdmin(args[1]);
    return;
  }

  if (args[0] === "--list") {
    await listPending();
    return;
  }

  const [studentUid, collegeId, outcome, ...rest] = args;
  const reason = rest.join(" ") || "manual review";
  if (!studentUid || !collegeId || !outcome) {
    fail(
      "Usage: node functions/scripts/admin-verify.mjs <student-uid> <collegeId> <outcome> \"<reason>\"",
    );
  }
  const adminUid = process.env.ADMIN_UID;
  if (!adminUid) {
    fail(
      "Set ADMIN_UID to the uid that holds the admin custom claim:\n" +
      "  $env:ADMIN_UID=\"<your-uid>\"   (PowerShell)\n" +
      "  export ADMIN_UID=<your-uid>    (bash)",
    );
  }
  await adjudicate(adminUid, studentUid, collegeId, outcome, reason);
}

main().catch((error) => fail(error?.message || String(error)));
