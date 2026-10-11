# Changelog

All notable changes to CampusForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Student Verification System** — backend-verified college affiliation gating for campus-restricted features
  - Trusted backend (`functions/`): `startVerification`, `getVerificationStatus`, `retryVerification`, `cancelVerification`, `submitAppeal`, admin-only `adjudicateVerification` / `revokeMembership`, signature-verified `handleProviderCallback` webhook and a nightly `expireVerifications` sweep
  - Verification state machine (`functions/src/policy.ts`): `not_started → pending → verified | rejected | needs_action | expired | cancelled`, with `suspended` on `verified`, defined transitions, attempt/cooldown/appeal limits and 12-month membership validity
  - New Firestore documents: `verifications/{uid:collegeId}` (with a private provider subcollection and an append-only audit subcollection), `memberships/{uid}`, `verification_audit/{id}`, `rate_limits/{scope:subject}`
  - Firestore Security Rules: an active membership is now required for `lost_found`, `marketplace`, `skills` (+ reservations), `chats`/`messages` and review creation; clients can no longer write verification status, membership, role or other backend-owned profile fields, or switch colleges once verification has started
  - Mobile: `contexts/VerificationContext.tsx` (authoritative status + actions), `utils/verification.ts` (callable client), `app/(auth)/verify.tsx` (state-driven verification screen)
  - Partner-college verification configuration on `colleges/{collegeId}` (`verificationEnabled`, `verificationProviderId`, `verificationProgramId`, `verificationMethod`); RVCE and IIT Bombay enabled, all others closed
  - `firebase.json` / `firestore.indexes.json` emulator configuration and 90 backend tests (state machine, provider fail-closed behaviour, HMAC callback validation, Firestore service behaviour and Security Rules)
  - `docs/student-verification.md` — lifecycle reference, retention policy, provider integration checklist and manual deployment steps

### Changed
- Registration and college-email flows now route into verification instead of the campus experience; the profile "verified" badge only renders when the backend confirms an active membership

### Fixed
- **Signup form keeps its input when choosing a college** — `college-select` returned via `router.push`, which mounted a fresh copy of the signup screen and discarded the name, email and passwords already entered. It now returns with `router.back()` and hands the selection over through `utils/collegeSelectionStore.ts`
- **Password visibility toggle** — `InputField` rendered `"•"` characters into a plain `TextInput` (`secureTextEntry={false}`), so the mask characters were written into the real value as the student typed and toggling visibility showed bullets followed by the last typed character. Masking now uses the native `secureTextEntry`
- **"Use a different account" on the verification screen** — the button only navigated to `/(auth)/login` without signing out, so the still-authenticated user was sent straight back to the verification screen by the route gate. It now signs out first, which also clears all user-specific verification state

### Security
- Campus access is granted only by the trusted backend after a validated provider result or an explicit admin decision; provider credentials are server-side only (no `EXPO_PUBLIC_*` variables)
- No verification provider is configured yet, so automated verification fails closed — no client path can mark a user as verified

- **Docker Development Environment** — Complete containerized setup for reproducible Windows development
  - `Dockerfile` with Node.js 20 Bookworm slim (Expo SDK 54 compatible)
  - `compose.yaml` with bind-mounted source, anonymous volumes for deps/cache
  - `.dockerignore` excluding node_modules, .expo, .env, google-services.json
  - `.env.example` template with all 9 EXPO_PUBLIC_* variables
  - `DOCKER.md` comprehensive Windows developer guide
- **Docker npm scripts** for streamlined workflow
  - `npm run start:docker` — Build & start container (foreground)
  - `npm run start:docker:detached` — Build & start container (background)
  - `npm run docker:logs` — Follow container logs
  - `npm run docker:stop` — Stop and remove container
  - `npm run docker:rebuild` — Full rebuild with volume clear
  - `npm run docker:clean` — Remove container, volumes, images
  - `npm run doctor` — Expo configuration validation
  - `npm run deps:check` — Dependency compatibility check
- **Documentation updates** for Docker development
  - README.md: Docker badge, Docker quick start as recommended Option 1
  - CONTRIBUTING.md: Docker Desktop prerequisite, Docker vs native setup options
  - docs/README.md: Docker Development link in documentation index
  - docs/architecture.md: Development environments table, Docker architecture diagram

### Changed
- **Expo SDK 53 → 54** (React Native 0.76 → 0.81.5, React 18 → 19)
- **React Compiler** enabled in app.json experiments
- **Expo Router v5 → v6** with typed routes
- **Firebase JS SDK** upgraded to v12.19.0
- **Expo Notifications** upgraded to ~0.32.17
- **React Navigation** upgraded to v7 (bottom-tabs, elements, native)
- **Expo SDK packages** aligned to ~54.0.x versions

### Fixed
- None

---

## [1.1.0] - 2025-01-15

### Added
- **Docker Development Environment** — Complete containerized setup for reproducible Windows development
  - `Dockerfile` with Node.js 20 Bookworm slim (Expo SDK 54 compatible)
  - `compose.yaml` with bind-mounted source, anonymous volumes for deps/cache
  - `.dockerignore` excluding node_modules, .expo, .env, google-services.json
  - `.env.example` template with all 9 EXPO_PUBLIC_* variables
  - `DOCKER.md` comprehensive Windows developer guide
- **Docker npm scripts** for streamlined workflow
- **Documentation updates** for Docker development

### Changed
- **Expo SDK 53 → 54** (React Native 0.76 → 0.81.5, React 18 → 19)
- **React Compiler** enabled in app.json experiments
- **Expo Router v5 → v6** with typed routes
- **Firebase JS SDK** upgraded to v12.19.0
- **Expo Notifications** upgraded to ~0.32.17
- **React Navigation** upgraded to v7 (bottom-tabs, elements, native)
- **Expo SDK packages** aligned to ~54.0.x versions

### Fixed
- None

---

## [1.0.0] - 2024-12-15

### Added
- **Core Features**
  - Lost & Found: Report lost/found items with images, location, and status tracking
  - Marketplace: Buy/sell items with price, category, condition, and image uploads
  - Skill Exchange: Peer-to-peer skill sharing with spot reservations
  - Real-time Chat: One-on-one messaging with push notifications
  - Ratings & Reviews: 5-star rating system with written reviews
  - Profile Management: Avatar, bio, college info, social links, privacy settings

- **College Communities**
  - College selection with verified domain search
  - College email verification (.edu domains)
  - Community-scoped content (all feeds filtered by collegeId)
  - Admin role for moderation

- **Technical Foundation**
  - Expo SDK 53 + React Native 0.76 + React 18
  - Expo Router v5 (file-based routing)
  - Firebase Auth + Firestore + Storage + Cloud Messaging
  - TypeScript strict mode
  - Custom design system ("The Fluid Campus") with dark-first theme
  - Reanimated 3 for 60fps animations
  - Expo Image for optimized loading
  - EAS Build + Expo Updates (OTA) configured

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

---

## [0.9.0] - 2024-11-01

### Added
- **Beta Features**
  - Basic Lost & Found CRUD
  - Marketplace listings with images
  - Authentication flow (register/login)
  - College onboarding flow
  - Basic chat functionality

- **Infrastructure**
  - Firebase project setup
  - Expo project initialization
  - GitHub Actions for CI (lint + type-check)
  - EAS Build configuration

### Known Issues
- Chat notifications not reliably delivered
- Image upload occasional failures on slow connections
- No offline support

---

## [0.5.0] - 2024-09-15

### Added
- **Prototype**
  - Expo Router navigation structure
  - Theme system (colors, typography, spacing)
  - Firebase configuration
  - Basic screen layouts

---

## Version History Summary

| Version | Date | Expo SDK | React Native | React | Key Milestone |
|---------|------|----------|--------------|-------|---------------|
| 1.1.0 | 2025-01-15 | 54 | 0.81.5 | 19.1.0 | Docker dev environment, SDK 54 upgrade |
| 1.0.0 | 2024-12-15 | 53 | 0.76 | 18.2.0 | Public launch |
| 0.9.0 | 2024-11-01 | 52 | 0.75 | 18.2.0 | Beta testing |
| 0.5.0 | 2024-09-15 | 51 | 0.74 | 18.2.0 | Internal alpha |

---

## Upgrade Guides

### Upgrading to 1.1.0 (from 1.0.x)

**Breaking Changes:**
- Expo SDK 53 → 54 (run `npx expo install --fix`)
- React Native 0.76 → 0.81.5
- React 18 → 19
- Expo Router v5 → v6 (typedRoutes enabled)
- React Navigation 6 → 7 (API changes in bottom-tabs, elements, native)

**Migration Steps:**
```bash
# 1. Update dependencies
npx expo install --fix

# 2. Clear caches
npx expo start --clear

# 3. Rebuild native (if using custom dev client)
eas build --platform all --profile development

# 4. Deploy Firestore rules (if changed)
firebase deploy --only firestore:rules

# 5. For Docker users: rebuild container
npm run docker:rebuild
```

### Upgrading to 1.0.0 (from 0.9.x)

**Breaking Changes:**
- Expo SDK 52 → 53 (run `npx expo install --fix`)
- React Native 0.75 → 0.76
- Firestore rules updated (re-deploy via `firebase deploy --only firestore:rules`)
- Design system tokens renamed (see `constants/theme.ts`)

**Migration Steps:**
```bash
# 1. Update dependencies
npx expo install --fix

# 2. Clear caches
npx expo start --clear

# 3. Rebuild native (if using custom dev client)
eas build --platform all --profile development

# 4. Deploy Firestore rules
firebase deploy --only firestore:rules
```

---

## Release Process

1. **Version bump** in `package.json` + `app.json`
2. **Changelog update** (this file)
3. **Git tag**: `git tag v1.1.0 && git push origin v1.1.0`
4. **EAS Build**: `eas build --platform all --profile production`
5. **App Store / Play Store** submission
6. **OTA Update**: `eas update --branch production --message "Release v1.1.0"`
7. **GitHub Release** with changelog

---

## Links

- [GitHub Releases](https://github.com/ChetanDev06/CampusForge/releases)
- [Expo Updates Dashboard](https://expo.dev/accounts/chetanDev06/projects/CampusForge/updates)
- [EAS Build Dashboard](https://expo.dev/accounts/chetanDev06/projects/CampusForge/builds)
### Fixed
- **Backend no longer wipes the user profile** � writing the mirrored verification status used \`tx.set\` without \merge\, so every approval, appeal, rejection or suspension replaced \users/{uid}\ and destroyed the student's name, email and college selection. All profile writes now merge, with a regression test
- **Illegal-state errors now report correctly** � attempting an appeal while a verification is still pending returned HTTP 429 (rate limit) instead of 412 (precondition failed)

### Added
- **Self-hosted verification backend** (\unctions/src/server\) � Express transport over the existing \VerificationService\, so the project no longer needs the Firebase Blaze plan that 2nd-gen Cloud Functions require
  - Routes: \/verify/start\, \/verify/status\, \/verify/retry\, \/verify/cancel\, \/verify/appeal\, \/verify/expire\, \/verify/callback\, plus admin-only \/verify/adjudicate\ and \/verify/revoke\
  - Firebase ID-token authentication and optional App Check enforcement (\REQUIRE_APP_CHECK=1\)
  - In-process nightly expiry sweep plus an admin-callable \/verify/expire\ for hosts that scale to zero
  - \unctions/Dockerfile\ (Render / Railway / Fly / Cloud Run / VPS) and \
pm --prefix functions start\
  - Shared \provider-webhook.ts\ used by both the server and the Cloud Functions entrypoint, so signature checks and idempotency are identical on either transport
- **Mobile client talks HTTP instead of callables** � \utils/verification.ts\ now uses \etch\ with the app's Firebase ID token against \EXPO_PUBLIC_VERIFICATION_API_URL\; transport errors are mapped to student-safe messages, and a missing URL is reported as "not connected" rather than a transient outage
- **Admin CLI** (\unctions/scripts/admin-verify.mjs\, \
pm --prefix functions run admin\) � grant an admin claim, list pending students, and approve/reject through the deployed backend
