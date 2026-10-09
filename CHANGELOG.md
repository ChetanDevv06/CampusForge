# Changelog

All notable changes to CampusForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Security policy documentation
- Contribution guidelines
- Code of conduct

### Changed
- Updated README with comprehensive documentation

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

| Version | Date | Expo SDK | React Native | Key Milestone |
|---------|------|----------|--------------|---------------|
| 1.0.0 | 2024-12-15 | 53 | 0.76 | Public launch |
| 0.9.0 | 2024-11-01 | 52 | 0.75 | Beta testing |
| 0.5.0 | 2024-09-15 | 51 | 0.74 | Internal alpha |

---

## Upgrade Guides

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
3. **Git tag**: `git tag v1.0.0 && git push origin v1.0.0`
4. **EAS Build**: `eas build --platform all --profile production`
5. **App Store / Play Store** submission
6. **OTA Update**: `eas update --branch production --message "Release v1.0.0"`
7. **GitHub Release** with changelog

---

## Links

- [GitHub Releases](https://github.com/ChetanDev06/CampusForge/releases)
- [Expo Updates Dashboard](https://expo.dev/accounts/chetanDev06/projects/CampusForge/updates)
- [EAS Build Dashboard](https://expo.dev/accounts/chetanDev06/projects/CampusForge/builds)