# CampusLoop — Release Notes

---

## [Unreleased] — In Progress

### 🐛 Bug Fixes

- **Home Screen: Fixed email flash on cold launch**
  Previously, when the app was fully closed and reopened, the greeting "Hey, [name]!" would briefly display the user's email prefix (e.g. `chetan.sharma`) for ~500ms before switching to the actual display name. This happened because Firebase Auth restores the session instantly but Firestore takes additional time to fetch the user profile.
  **Fix:** Removed the email fallback entirely. The greeting now shows a shimmer skeleton placeholder until the Firestore profile document resolves, then swaps in the real name cleanly.
  _Files changed: `app/(tabs)/index.tsx`, `contexts/AuthContext.tsx`_

- **Home Screen: Fixed 0 → real number flash in listing count subtitle**
  The subtitle "There are X new listings in your circle today" would briefly show `0` for the count before the Firestore listeners for lost-found and marketplace fired for the first time.
  **Fix:** Added a `countsReady` flag that tracks when both the lost-found and marketplace snapshots have each resolved at least once. The subtitle line stays as a shimmer skeleton until both are ready, then reveals the real count in a single clean transition.
  _Files changed: `app/(tabs)/index.tsx`_

- **Home Screen: Deleted items now instantly disappear from Recent Activity feed**
  When a user deleted a marketplace, lost-found, or skill listing, it would remain visible in the home feed until the app was fully restarted. Clicking it would show an "item removed" error.
  **Fix:** Replaced the one-time `getDocs` feed fetch with three parallel `onSnapshot` real-time Firestore listeners (one each for marketplace, lost_found, and skills). Any add, update, or delete is now pushed to the home feed instantly. Listeners are properly unsubscribed on unmount and when the collegeId changes.
  _Files changed: `app/(tabs)/index.tsx`_

### ✨ Improvements

- **Home Screen: Shimmer skeleton loading states**
  All data-dependent content on the home screen (greeting name, listing count subtitle, feed cards) now uses animated shimmer skeleton placeholders while async data is loading. This eliminates all visible jumps and zero-states, matching the loading pattern used by apps like Instagram and Spotify.
  _Files changed: `app/(tabs)/index.tsx`_

- **Home Screen: Removed debug `console.log` statements**
  Removed `📊 [Debug]` console logs from the lost-found and marketplace count listeners that were left from development.
  _Files changed: `app/(tabs)/index.tsx`_

- **Navigation: Fixed `getDocs` crash after feed refactor**
  After converting the home feed to `onSnapshot` listeners, `getDocs` was accidentally removed from the import while still being used inside the marketplace count listener. Restored the import to fix the `ReferenceError: Property 'getDocs' doesn't exist` runtime crash.
  _Files changed: `app/(tabs)/index.tsx`_

- **Detail Screens: Fixed filename header flash on navigation**
  When navigating to skill, market, or lost-found detail screens, Expo Router would briefly flash a raw filename-based header (e.g. `skill-details[id]`) before the screen mounted its own custom header. Fixed by explicitly registering all detail, post, edit, and review screens in the root `_layout.tsx` Stack with `headerShown: false`.
  _Files changed: `app/_layout.tsx`_

- **Item Details: Redesigned no-image fallback banner**
  When a lost/found post had no photo, the detail screen showed a plain 100px dark empty rectangle that looked broken. Replaced with a rich 160px styled banner featuring a large icon circle, the type badge (LOST/FOUND), a decorative ghost icon, and a subtle "No photo attached" label. Banner color is contextual — red-tinted for lost reports, purple-tinted for found reports.
  _Files changed: `app/item-details/[id].tsx`_

- **Item Details: Implemented Save and Share buttons**
  The bookmark and share buttons in the item detail footer were non-functional (no `onPress` handler). Implemented both:
  - **Save:** Toggles a document in `users/{uid}/savedItems/{itemId}` in Firestore. Bookmark icon fills purple when saved, outline when not. Triggers a scale bounce animation on tap. Saved state is restored correctly on re-open.
  - **Share:** Opens the native OS share sheet with the item title, type (Lost/Found), location, and an app attribution line.
  _Files changed: `app/item-details/[id].tsx`_

---

## Previous Sessions

### Firebase & Infrastructure

- Integrated **Firebase Crashlytics** for crash reporting on physical devices.
- Integrated **Firebase Performance Monitoring**.
- Implemented real-time Firestore listener for **campus member counts** in admin/community views.
- Secured the feed fetching process with auth guards to prevent unauthenticated reads.

### Marketplace & Listings

- Added **Skill Share** feature connected to the marketplace tab.
- Unified the posting flow — marketplace and skill share posts use a shared creation screen with dynamic category-aware fields.
- Standardized all pricing to **Indian Rupee (₹)** across all listing cards, detail screens, and filters.

### Navigation & Routing

- Resolved navigation routing conflicts between the marketplace and skill share tabs.
- Fixed deep-link routing for market-details and skill-details screens.

### UI / UX Polish

- Migrated full color palette to a professional **dark-slate theme** (`#15151A` base).
- Applied consistent **glassmorphism cards**, rounded corners (`borderRadius: 32`), and premium spacing throughout.
- Dynamic **college short name** displayed in the top nav header instead of a static label.
- Lost & Found location labels now display in **uppercase campus hub format**.
- Marketplace badge shows live "X NEW ARRIVALS" count or falls back to "VIEW MARKET".
- Messages grid card shows a **notification dot** for unread chats.
- Cinematic **rotating search placeholder** with animated fade+slide ticker on the home search bar.

---

_This file is updated automatically as changes are made. Each entry includes the affected files for traceability._
