# Student Verification System

CampusForge gates every college-restricted feature behind a **backend-verified**
student affiliation. This document is the operational reference for the
verification lifecycle, its data model, the trusted backend, security rules,
the mobile integration, and the provider work that is still outstanding.

> **Status:** the provider-independent infrastructure is complete and fail-closed.
> No verification provider is configured in this build, so **no automated
> verification succeeds**. Campus access can currently only be granted by an
> explicit admin adjudication. Do not tell users that automated verification
> works until a provider is contracted, configured and confirmed to cover the
> partner colleges (see [Provider integration status](#provider-integration-status)).

---

## 1. Product rules enforced

| # | Rule | Where enforced |
|---|------|----------------|
| 1 | A Firebase account can be created before verification | `app/(auth)/register.tsx` |
| 2 | New accounts start restricted | `functions/src/verification-service.ts` (`accountStatus: "restricted"`) |
| 3 | Selecting a college does **not** verify affiliation | `app/_layout.tsx` gate + Security Rules |
| 4 | A verified personal email does **not** grant access | `firestore.rules` (`collegeEmailVerified` grants nothing) |
| 5 | Access only after the backend validates a result | `VerificationService.applyProviderOutcome` / `adjudicate` |
| 6 | Verification applies to the exact selected college | `startAttempt` rejects a college mismatch |
| 7 | Unverified users cannot reach restricted data | Security Rules require an active membership |
| 8 | Rejected users get a retry/appeal path | `retryVerification`, `submitAppeal` |
| 9 | Provider errors are not treated as fraud | `VERIFICATION_PROVIDER_UNAVAILABLE` → retry state |
| 10 | Clients cannot change verification status or privileges | Rules deny all writes to `verifications`/`memberships` |

Only **two partner campuses** are enabled by default (RV College of Engineering
and IIT Bombay). All other seeded campuses have `verificationEnabled: false` and
fail closed.

---

## 2. Firestore data model

```
users/{uid}                     profile + backend-mirrored status
  ├─ uid, name, email, college*  (client-writable)
  └─ accountStatus, verificationStatus, verifiedCollegeId,
     membershipStatus, role      (backend-only)

colleges/{collegeId}            admin-controlled partner config
  ├─ name, shortName, domain, domains, location, verified, memberCount
  └─ verificationEnabled, verificationProviderId,
     verificationProgramId, verificationMethod

verifications/{uid:collegeId}   ONE attempt per (user, college)
  ├─ status, method, policyVersion, attemptCount,
  │  createdAt, reviewedAt, expiresAt, canRetry, canAppeal, nextAction,
  │  lastErrorCode/Message, providerId, providerProgramId, lastEventId
  ├─ private/provider           providerReference + redacted responses  (NO client access)
  └─ audit/{eventId}            append-only transition history

memberships/{uid}               one membership per user
  └─ collegeId, status, verificationId, activatedAt/By, expiresAt, …

verification_audit/{id}         administrative audit trail (admin reads only)
rate_limits/{scope:subject}     server-only abuse counters
```

Design notes:

- **Attempt id is deterministic** (`{uid}:{collegeId}`), so a retry reuses the
  same document and increments `attemptCount` instead of creating unbounded
  duplicates. This also makes idempotent provider processing trivial.
- **Provider references are private.** They live in
  `verifications/{id}/private/provider`, which no client can read or write.
- **`memberships/{uid}`** is a single document per user, which structurally
  prevents duplicate memberships and replay-based double activation.
- **Server timestamps** are used everywhere the backend writes.

---

## 3. Verification state machine

```
                ┌──────────────┐
                │ not_started  │
                └──────┬───────┘
                       │ start
                       ▼
   ┌──────────►   ┌─────────┐   approved    ┌──────────┐
   │              │ pending ├───────────────►│ verified │
   │              └────┬────┘                └────┬─────┘
   │       needs_action│rejected│expired│cancel   │ suspend/expire
   │                   ▼        ▼                    ▼
   │            ┌──────────────┐ ┌───────────┐ ┌───────────┐
   └────────────│ needs_action │ │  rejected │ │ suspended │
      retry     └──────┬───────┘ └─────┬─────┘ └─────┬─────┘
                       │               │ appeal      │
                       └───────────────┴─────────────┘

expired   → pending (retry)
cancelled → pending (retry)
```

- Transitions are declared in `functions/src/policy.ts` (`canTransition`,
  `assertTransition`) and unit-tested. Nothing client-supplied can begin a
  transition.
- `not_started → verified` is impossible; review cannot be skipped.
- An unrecognised provider outcome maps to `needs_action`, never `verified`.

### Limits

| Limit | Value |
|-------|-------|
| Attempts per (user, college) | 5 |
| Cooldown between attempts | 24 h |
| Appeals per (user, college) | 2 |
| Open-attempt / review window | 30 days |
| Membership validity | 12 months (then re-verify) |

---

## 4. Trusted backend (`functions/`)

| Callable | Purpose |
|----------|---------|
| `startVerification` | validate college + rate limit + create/resume an attempt |
| `getVerificationStatus` | safe, own-user status projection |
| `retryVerification` | new attempt after failure/expiry (limits + cooldown) |
| `cancelVerification` | abandon an in-flight attempt |
| `submitAppeal` | appeal a rejected/needs_action decision |
| `adjudicateVerification` *(admin)* | manual review decision |
| `revokeMembership` *(admin)* | suspend / revoke / expire / reinstate |
| `handleProviderCallback` *(HTTP)* | signature-verified provider webhook |
| `expireVerifications` *(scheduled)* | nightly expiry sweep |

Security properties:

- Firebase Auth is verified on every callable; admin actions additionally
  require the `admin` custom claim **or** `users/{uid}.role == "admin"`.
- Rate limits are enforced per user (and per provider reference for webhooks)
  through Firestore counters.
- Every attempt is bound to `(userId, collegeId)` at creation, and the college
  in the user's profile must match.
- Provider events must match the stored `providerReference`, `providerId` and
  `providerProgramId`; a mismatch is rejected.
- Event processing is idempotent by `eventId` (checked before and inside the
  transaction).
- Membership changes happen in the **same transaction** as the status change
  and are derived from the current stored membership, so a concurrent event
  cannot double-activate or reactivate a revoked membership.
- Nothing logs tokens, passwords or raw identity documents; provider payloads
  are redacted before being persisted (`redactPayload`).

### Firebase App Check (recommended follow-up)

App Check is **not** enabled in this build. It should be added before public
release:

1. Enable App Check in the Firebase console with Play Integrity (Android) and
   App Attest (iOS).
2. Add `expo-firebase-app-check` (or the React Native Firebase module) to the
   app — this adds a native dependency, so verify Expo Go compatibility before
   enabling it for development builds.
3. Turn on App Check enforcement for Cloud Functions and Firestore.

App Check raises the cost of scripted abuse but is **not** a substitute for
authentication, authorization or provider-result validation: every check in
this document remains required even with App Check enabled.

---

## 5. Security rules (summary)

`firestore.rules` now requires an **active membership** for every
college-restricted collection:

- `lost_found`, `marketplace`, `skills` (+ `reservations`), `chats` (+ `messages`),
  `reviews` (create).
- `users`: backend-owned fields (`verificationStatus`, `accountStatus`,
  `verifiedCollegeId`, `membershipStatus`, `role`) are immutable from the client;
  college selection is only allowed while no verification exists and no
  membership is active.
- `verifications`: read own only; **all writes denied**.
- `verifications/{id}/private/**`: read and write denied.
- `memberships`: read own/admin; **all writes denied**.
- `verification_audit`, `rate_limits`: admin read only / no client access.
- `colleges`: signed-in read; admin write only (provider program ids cannot be
  written by a client).

Remember that the Admin SDK bypasses these rules; the backend enforces the same
authorization internally.

---

## 6. Mobile integration

- `contexts/VerificationContext.tsx` — authoritative status + actions
  (`start`, `retry`, `appeal`, `cancel`, `refresh`). The status is re-read from
  the backend on sign-in, on app start, on college change and after every
  action; the Firestore mirror on `users/{uid}.verificationStatus` only
  optimises live updates and can never grant access.
- `app/(auth)/verify.tsx` — one screen driven by the verification state:
  start, in progress, pending review, more information needed, success,
  unsuccessful (retry/appeal), expired, suspended, cancelled, and provider
  errors.
- `app/_layout.tsx` — routes unverified users to `/(auth)/verify` and never
  gates navigation before the authoritative status has been read. Admins are
  exempt. Sign-out clears all user-specific verification state.
- `app/(auth)/register.tsx` — after account creation the user goes straight to
  the verification flow, never into the campus experience.
- `app/(auth)/college-email.tsx` — a verified personal email now leads to the
  verification flow rather than the tabs.
- `app/(tabs)/profile.tsx` — the "verified" badge only renders when
  `hasCampusAccess` is true, and a verification status chip links to the flow.

---

## 7. Privacy and retention

CampusForge collects and stores only: the selected college id, the verification
status, an opaque provider reference, the provider id/program id, timestamps,
the attempt counter and a redacted provider response. Identity documents are
**never** stored by CampusForge when a provider-hosted flow is used.

| Data | Retention |
|------|-----------|
| Verification attempt (`verifications/{id}`) | 12 months after the last transition, then deleted |
| Provider references + redacted responses | Same as the attempt |
| Attempt audit entries | Same as the attempt |
| Membership record | Life of the account, deleted on account deletion |
| Failed/abandoned attempts | 90 days, then deleted |
| `rate_limits` counters | Window length (≤ 24 h) |
| Appeals | 12 months after the decision |

`redactPayload` strips any provider field matching
`document|aadhaar|dob|birth|passport|photo|token|secret|authorization|password|address|phone|national`
(recursively) and truncates long values before anything is persisted.

CampusForge does **not** collect Aadhaar numbers, biometrics or unrelated
identity data. If a provider requires more, that processing is governed by the
provider's contract, not by CampusForge.

---

## 8. Provider integration status

**Nothing is configured.** The adapter registry contains only a fail-closed
stub (`functions/src/providers.ts`). Until a real adapter is implemented,
registered and configured:

- `startVerification` returns `VERIFICATION_PROVIDER_NOT_CONFIGURED`
  (`failed-precondition`, HTTP 503) for campuses configured for a provider
  redirect, and no attempt is created.
- Campuses with `verificationMethod: "manual_review"` queue an attempt for an
  admin decision via `adjudicateVerification`.

### To integrate a provider (e.g. SheerID)

1. Confirm with the provider, **in writing**, that it supports current-student
   affiliation verification for each partner college (IITs use several different
   identity systems; do not assume shared student email domains).
2. Confirm the program IDs for those colleges and get sandbox credentials.
3. Implement `functions/src/providers/<name>.ts` with:
   - `initiate` → provider redirect URL,
   - `getStatus` → authoritative server-side retrieval,
   - `handleCallback` → signature-validated event parsing.
4. Register it in `PROVIDER_ADAPTERS` in `functions/src/providers.ts`.
5. Store credentials as a function secret:
   ```bash
   firebase functions:secrets:set VERIFICATION_PROVIDERS
   ```
6. Set the partner college documents:
   ```
   verificationEnabled: true
   verificationProviderId: "<adapter id>"
   verificationProgramId: "<provider program id>"
   verificationMethod: "provider_redirect"
   ```
7. Point the provider's webhook at
   `https://<region>-<project>.cloudfunctions.net/handleProviderCallback?provider=<id>`
   and confirm the signature scheme matches
   `functions/src/callback-auth.ts` (HMAC-SHA256 over `<timestamp>.<rawBody>`).
8. Re-enable automated review only after a successful end-to-end sandbox run.

Do not invent endpoints, credentials or successful verification results.

---

## 9. What is needed to make verification work

The backend runs as a **self-hosted HTTP service** (`functions/src/server`) so the
project stays on the Firebase Spark plan. It needs three things: the backend
running, a partner campus enabled, and an admin who approves students until a
provider is wired up.

### 9.1 Run the backend

```bash
# Build
npm --prefix functions run build

# Point the Admin SDK at a service account (Firebase console -> Project
# settings -> Service accounts -> Generate new private key). Keep it OUTSIDE
# the repository.
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\campusloop-admin.json"   # PowerShell
# export GOOGLE_APPLICATION_CREDENTIALS=~/keys/campusloop-admin.json  # bash

# Start (defaults to http://localhost:8080)
npm --prefix functions start
```

Optional environment variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `8080`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service-account key file |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Same credentials, inline JSON |
| `VERIFICATION_PROVIDERS` | Provider configs (server-side only) |
| `REQUIRE_APP_CHECK` | `1` to demand an App Check token |

Deploy with the bundled Dockerfile (Render, Railway, Fly.io, Cloud Run, VPS):

```bash
docker build -f functions/Dockerfile -t campusforge-verify .
docker run -p 8080:8080 -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/key.json campusforge-verify
```

Expose it over HTTPS (your host gives you a URL such as
`https://campusforge-verify.onrender.com`) and set that in the app's `.env`:

```
EXPO_PUBLIC_VERIFICATION_API_URL="https://campusforge-verify.onrender.com"
```

Then restart the app with a clean cache — Expo inlines `EXPO_PUBLIC_*` values at
bundle time:

```bash
npx expo start -c
```

Endpoints: `/verify/start`, `/verify/status`, `/verify/retry`, `/verify/cancel`,
`/verify/appeal`, `/verify/expire`, `/verify/callback`, plus the admin-only
`/verify/adjudicate` and `/verify/revoke`.

### 9.2 Enable a campus

In `colleges/{collegeId}` (Firestore console or Admin SDK):

```json
{
  "verificationEnabled": true,
  "verificationProviderId": null,
  "verificationProgramId": null,
  "verificationMethod": "manual_review"
}
```

`app/admin/seed-colleges.tsx` and the seed button in `college-select` write these
values: **RVCE and IIT Bombay are enabled**, every other seeded campus stays
closed (`verificationEnabled: false`) and fails closed.

### 9.3 Approve students (interim manual review)

Because no provider is configured yet, a human approves each student:

```bash
# One time: grant the first admin (your own uid, from Authentication -> Users)
node functions/scripts/admin-verify.mjs --grant-admin <your-uid>

# Students waiting for review
node functions/scripts/admin-verify.mjs --list

# Approve / reject
$env:ADMIN_UID="<your-uid>"
node functions/scripts/admin-verify.mjs <student-uid> rvce approved "manual review"
```

`functions/scripts/admin-verify.mjs` calls the deployed backend over HTTPS with
a real ID token, so it passes the same authentication, authorization,
transaction and audit checks as the mobile app — it cannot grant anything the
backend would not.

With that in place the flow works end to end without any provider:

1. Student signs up, picks a partner campus, lands on the verification screen.
2. `/verify/start` creates a `pending` attempt at `verifications/{uid}:{collegeId}`.
3. An admin runs the approve command above.
4. The backend writes `memberships/{uid}` as `active` and campus access turns on.

Automated verification (no human step) needs the provider work in section 8.

### 9.4 Local end-to-end test (no hosting)

```bash
# Terminal 1 — emulators
npx firebase emulators:start --only firestore --only auth

# Terminal 2 — backend against the emulator
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:PORT="8080"
npm --prefix functions start
```

Then set `EXPO_PUBLIC_VERIFICATION_API_URL` to `http://10.0.2.2:8080` for the
Android emulator, `http://localhost:8080` for the iOS simulator or web, and
`http://<LAN-IP>:8080` for a physical device.

### 9.5 Cloud Functions are still supported

`functions/src/index.ts` still exports the Firebase callables and the scheduled
expiry sweep, so switching back to Cloud Functions only requires deploying them
after upgrading to the Blaze plan — the webhook logic is shared, so behaviour
would be identical:

```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## 10. Tests

| Suite | Command | Coverage |
|-------|---------|----------|
| Policy / provider / callback auth (pure) | `npm --prefix functions test` | state machine, fail-closed outcomes, retry/appeal limits, program resolution, HMAC validation, payload redaction |
| Verification service (Firestore emulator) | `npm --prefix functions run test:emulator` | success, duplicate callbacks, forged references, college mismatch, rejection/suspension, expiry, manual review, audit trail |
| Firestore Security Rules (emulator) | `npm --prefix functions run test:emulator` | unverified read/write denial, self-granted membership denial, backend-field protection, college switching, admin-only collections |
| Mobile typecheck | `npm run typecheck` | whole app |
| Mobile lint | `npm run lint` | `app components hooks utils` |

The emulator suites skip themselves when `FIRESTORE_EMULATOR_HOST` is unset, so
a plain `npm --prefix functions test` run stays green without Java.
