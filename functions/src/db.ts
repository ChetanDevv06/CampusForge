/**
 * Firestore collection names, document path helpers and constants shared by the
 * CampusForge backend.
 *
 * Collections:
 *   users/{uid}                — ordinary profile + mirrored account status
 *   colleges/{collegeId}       — admin-controlled partner college config
 *   verifications/{attemptId}  — ONE verification attempt per (user, college)
 *   verifications/{attemptId}/private/provider — opaque provider reference
 *   verifications/{attemptId}/audit/{eventId} — append-only transition history
 *   memberships/{uid}          — college membership, activated only by backend
 *   verification_audit/{id}    — minimal administrative audit trail
 *   rate_limits/{key}          — server-only abuse-prevention counters
 */

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

let _db: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }
    _db = getFirestore();
  }
  return _db;
}

export const COLLECTIONS = {
  users: "users",
  colleges: "colleges",
  verifications: "verifications",
  memberships: "memberships",
  verification_audit: "verification_audit",
  rate_limits: "rate_limits",
  // Pre-existing app collections. Unchanged by the verification system.
  college_requests: "college_requests",
  moderation_reports: "moderation_reports",
  lost_found: "lost_found",
  marketplace: "marketplace",
  skills: "skills",
  chats: "chats",
  notifications: "notifications",
  reports: "reports",
  config: "config",
} as const;

/** One attempt document per (user, college) keeps retries idempotent. */
export function attemptIdFor(userId: string, collegeId: string): string {
  return `${userId}:${collegeId}`;
}

export const PATHS = {
  user: (userId: string) => `${COLLECTIONS.users}/${userId}`,
  college: (collegeId: string) => `${COLLECTIONS.colleges}/${collegeId}`,
  verification: (attemptId: string) => `${COLLECTIONS.verifications}/${attemptId}`,
  verificationPrivate: (attemptId: string) =>
    `${COLLECTIONS.verifications}/${attemptId}/private/provider`,
  verificationAudit: (attemptId: string, eventId: string) =>
    `${COLLECTIONS.verifications}/${attemptId}/audit/${eventId}`,
  membership: (userId: string) => `${COLLECTIONS.memberships}/${userId}`,
  audit: (eventId: string) => `${COLLECTIONS.verification_audit}/${eventId}`,
  rateLimit: (key: string) => `${COLLECTIONS.rate_limits}/${key}`,
} as const;

// ─── Protected fields ────────────────────────────────────────────────────────
// Clients may never write these. The Firebase Admin SDK bypasses Security
// Rules, so privileged code must respect this list itself.

export const MEMBERSHIP_WRITABLE_BY_BACKEND = [
  "userId",
  "collegeId",
  "status",
  "verificationId",
  "policyVersion",
  "method",
  "activatedAt",
  "activatedBy",
  "updatedAt",
  "suspendedAt",
  "suspendedBy",
  "revokedAt",
  "revokedBy",
  "expiresAt",
] as const;

export const USER_FIELDS_OWNED_BY_BACKEND = [
  "accountStatus",
  "verificationStatus",
  "verifiedCollegeId",
  "membershipStatus",
  "role",
  "rating",
  "reviewCount",
] as const;

/** Fields of a verification attempt that are safe to return to a client. */
export const SAFE_VERIFICATION_FIELDS = [
  "id",
  "userId",
  "collegeId",
  "status",
  "method",
  "policyVersion",
  "attemptCount",
  "createdAt",
  "updatedAt",
  "reviewedAt",
  "expiresAt",
  "canRetry",
  "canAppeal",
  "nextAction",
  "lastErrorCode",
  "lastErrorMessage",
] as const;
