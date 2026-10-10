# CampusForge ⚒️

[![Expo](https://img.shields.io/badge/Expo-54.0-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-12.11-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](DOCKER.md)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **A smart campus exchange platform** bridging the gap between students. Whether you've lost an item, want to sell a textbook, or need to learn a new skill—CampusForge is the go-to app for your university community.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🔍 Lost & Found** | Report lost items or help others find theirs with real-time updates and location tagging |
| **🛍️ Marketplace** | Buy and sell items directly within your campus community with image uploads and price tags |
| **💡 Skill Exchange** | Teach what you know, learn what you don't—peer-to-peer skill sharing with spot reservations |
| **💬 Real-time Chat** | Communicate safely with other students via Firebase-powered messaging with push notifications |
| **⭐ Ratings & Reviews** | Build trust within the community through transparent rating system |
| **👤 Profile Management** | Customize avatar, display campus credentials, manage social links, and privacy settings |
| **🎓 College Communities** | Verified college email domains, automatic community filtering, and college-specific feeds |
| **🔔 Smart Notifications** | Local + push notifications for messages, new listings, and activity in your circle |
| **🔎 Unified Search** | Cross-feature search with animated suggestions, filters, and real-time results |
| **🎨 Premium Design** | Dark-first design system with gradients, glassmorphism, Reanimated transitions, and skeleton loading |

---

## 🏗 Architecture Overview

```
CampusForge/
├── app/                          # Expo Router file-based routing
│   ├── (auth)/                   # Auth flow (login, register, college verification)
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── index.tsx             # Home feed (unified marketplace + lost/found + skills)
│   │   ├── lost-found.tsx        # Lost & Found dedicated screen
│   │   ├── market.tsx            # Marketplace + Skills tabs
│   │   ├── skills.tsx            # Skill Exchange screen
│   │   ├── profile.tsx           # User profile & settings
│   │   └── explore.tsx           # Documentation/examples screen
│   ├── _layout.tsx               # Root layout, auth guards, providers
│   ├── modal.tsx                 # Modal presentation screens
│   ├── messages.tsx              # Chat list
│   ├── chat/[id].tsx             # Individual chat screen
│   ├── *-details/[id].tsx        # Detail screens for each content type
│   ├── post-*.tsx                # Create listing screens
│   ├── onboarding.tsx            # First-time user flow
│   ├── notifications.tsx         # Notification center
│   ├── search.tsx                # Global search
│   └── settings.tsx              # App settings
├── components/                   # Reusable UI components
│   ├── ui/                       # Design system primitives (collapsible, icon-symbol)
│   ├── *.tsx                     # Feature components (modals, map pickers, etc.)
├── contexts/                     # React Context providers
│   └── AuthContext.tsx           # Firebase auth + Firestore profile sync + notifications
├── constants/                    # Design tokens & configuration
│   └── theme.ts                  # Colors, typography, spacing, gradients, shadows
├── utils/                        # Business logic & helpers
│   ├── notifications.ts          # Push/local notification handling
│   ├── chat.ts                   # Chat utilities
│   ├── moderation.ts             # Content moderation (bad words filter)
│   ├── storage.ts                # AsyncStorage wrappers
│   ├── marketTabStore.ts         # Cross-tab state for marketplace
│   └── useNotifications.ts       # Notification hook
├── firebaseConfig.ts             # Firebase initialization (auth, firestore, storage)
├── app.json                      # Expo configuration
├── eas.json                      # EAS Build configuration
└── tsconfig.json                 # TypeScript configuration
```

---

## 🛠 Tech Stack

| Category | Technologies |
|----------|--------------|
| **Framework** | Expo SDK 54, React Native 0.81, React 19, Expo Router v6 |
| **Language** | TypeScript 5.9 (strict mode) |
| **Backend** | Firebase Auth, Cloud Firestore, Firebase Storage, Firebase Cloud Messaging |
| **Styling** | Custom design system, Expo Linear Gradient, React Native Reanimated 4 |
| **Navigation** | Expo Router (file-based), React Navigation 7 |
| **Fonts** | Plus Jakarta Sans, Manrope, Space Mono (Expo Google Fonts) |
| **Icons** | Expo Vector Icons (Ionicons), Custom SF Symbols |
| **Media** | Expo Image, Expo Image Picker, Expo AV, Expo Video |
| **Maps** | React Native Maps |
| **Testing** | ESLint (Expo config), TypeScript type checking |
| **CI/CD** | EAS Build, Expo Updates (OTA) |
| **Monitoring** | Firebase Crashlytics |

---

## 🚀 Quick Start

### Option 1: Docker Development (Recommended for Windows)

No local Node.js/npm installation needed. Runs in a container with hot reload.

```bash
# 1. Clone the repository
git clone https://github.com/ChetanDev06/CampusForge.git
cd CampusForge

# 2. Configure environment
cp .env.example .env
# Edit .env with your Firebase credentials

# 3. Start development server in Docker
npm run start:docker
# Or detached: npm run start:docker:detached && npm run docker:logs
```

See **[DOCKER.md](DOCKER.md)** for complete guide: networking, troubleshooting, Android device connection, and Windows Firewall setup.

---

### Option 2: Native Development

### Prerequisites

- **Node.js** ≥ 20 (LTS recommended) — [`nvm`](https://github.com/nvm-sh/nvm) or [`fnm`](https://github.com/Schniz/fnm) recommended
- **npm** ≥ 10 or **yarn** ≥ 4 / **pnpm** ≥ 9
- **Expo CLI** — `npm install -g @expo/cli`
- **Expo Go** app on iOS/Android for physical device testing
- **Firebase Project** with Auth, Firestore, Storage enabled
- **iOS Simulator** (Xcode) / **Android Emulator** (Android Studio) for local development

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ChetanDev06/CampusForge.git
cd CampusForge

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Firebase credentials (see below)

# 4. Start development server
npx expo start
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Firebase Configuration (Required)
EXPO_PUBLIC_FIREBASE_API_KEY="your-api-key"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
EXPO_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Optional: Cloudinary for image optimization
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

> **Firebase Setup:** Create a project at [Firebase Console](https://console.firebase.google.com/), enable **Authentication** (Email/Password), **Cloud Firestore**, **Storage**, and **Cloud Messaging**. Add a **Web App** to get the config values above. For iOS/Android, add platform-specific apps and download `GoogleService-Info.plist` / `google-services.json`.

---

## 📱 Running the App

| Platform | Command | Description |
|----------|---------|-------------|
| **Development Server** | `npx expo start` | Starts Metro bundler with QR code |
| **iOS Simulator** | `npx expo start --ios` / press `i` | Opens in iOS Simulator (macOS only) |
| **Android Emulator** | `npx expo start --android` / press `a` | Opens in Android Emulator |
| **Physical Device** | Scan QR code with **Expo Go** | iOS: Camera app / Android: Expo Go app |
| **Web** | `npx expo start --web` / press `w` | Opens in browser at `localhost:8081` |
| **Production Build** | `eas build --platform all` | Creates store-ready binaries via EAS |

### Development Commands

```bash
# Docker Development
npm run start:docker          # Build & start container (foreground)
npm run start:docker:detached # Build & start container (background)
npm run docker:logs           # Follow container logs
npm run docker:stop           # Stop and remove container
npm run docker:rebuild        # Full rebuild (clear volumes, reinstall deps)
npm run docker:clean          # Remove container, volumes, images

# Lint & type-check
npm run lint          # Expo ESLint config
npm run typecheck     # TypeScript type checking
npm run doctor        # Expo configuration validation
npm run deps:check    # Dependency compatibility check

# Reset project (clears cache, reinstalls)
npm run reset-project

# Platform-specific native builds
npm run android       # expo run:android
npm run ios           # expo run:ios
npm run web           # expo start --web
```

---

## 🔐 Authentication & College Verification Flow

CampusForge uses a **multi-stage onboarding** to ensure trusted campus communities:

```
1. Email/Password Registration
       ↓
2. College Selection (search verified domains)
       ↓
3. College Email Verification (.edu / verified domains)
       ↓
4. Profile Completion (name, major, grad year, bio)
       ↓
5. Onboarding Tutorial → Main App
```

- **College Communities**: All content is scoped to the user's verified `collegeId`
- **Role-based Access**: `admin` role for moderation capabilities
- **Session Persistence**: React Native AsyncStorage for auth state (native), standard Firebase persistence (web)

---

## 🎨 Design System

CampusForge implements a **custom dark-first design system** ("The Fluid Campus") defined in [`constants/theme.ts`](constants/theme.ts):

### Color Palette
```typescript
// Primary Brand
primary: "#6B52FF"           // Main brand purple
primary_container: "#9396ff" // Lighter variant

// Semantic Colors
success: "#34EE9A"           // Green for found items
error: "#ff6e84"             // Red for lost items
warning: "#ffb2b9"
tertiary: "#ffa5d8"          // Pink for skills

// Surfaces (elevation-based)
surface_container_low: "#18181A"
surface_container: "#1C1C20"
surface_container_high: "#1f1f22"
```

### Typography Scale
- **Display**: Plus Jakarta Sans 800 (48px) — Hero headlines
- **Headline**: Plus Jakarta Sans 700 (28px) — Section titles
- **Title**: Plus Jakarta Sans 600 (20px) — Card titles
- **Body**: Manrope 400 (16px) — Primary reading text
- **Label**: Manrope 600 (14px) — Buttons, tags, metadata

### Spacing & Roundness
- **Spacing**: 4/8/16/24/32/48px scale + 18px minimum margin
- **Roundness**: 8/16/24/32px + 999px (pill)

### Gradients & Shadows
- **Primary Gradient**: `["#a4a6ff", "#9396ff"]`
- **Category Gradients**: Lost (red), Found (green), Skills (pink)
- **Elevation Shadows**: sm/md/lg/ambient with consistent opacity

---

## 🔥 Key Technical Highlights

### Real-time Unified Feed (Home Screen)
The home screen merges **three Firestore collections** (marketplace, lost_found, skills) into a single chronological feed with:
- Real-time `onSnapshot` listeners per collection
- Client-side merge + sort by `createdAt`
- Filter tabs (All / Found / Sale / Skills)
- Search with debounced filtering + animated ticker suggestions
- Skeleton loading states (no flash-of-zero)

### Auth Context Architecture
[`AuthContext.tsx`](contexts/AuthContext.tsx) manages:
- Firebase Auth state listener
- Firestore profile real-time sync (`onSnapshot`)
- Global conversation listener for push notifications
- Online/offline presence heartbeat (AppState API)
- Crashlytics user attribution

### Notification System
- **Local Notifications**: `expo-notifications` for in-app alerts
- **Push Notifications**: FCM via `@react-native-firebase/messaging`
- **Smart Filtering**: Only notifies on *new* messages from *other* users
- **Deep Linking**: Notification payload navigates to specific chat/listing

### Performance Optimizations
- **Firestore**: `memoryLocalCache` + `experimentalForceLongPolling` for reliability
- **Images**: `expo-image` with `transition` prop for smooth loading
- **Animations**: `react-native-reanimated` worklets (UI thread)
- **Fonts**: `expo-font` preloading with splash screen sync
- **Lists**: `FlatList`/`ScrollView` with `contentContainerStyle` padding

---

## 🧪 Testing & Quality

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Format check (if prettier configured)
npx prettier --check .
```

> **Note**: This project uses Expo's ESLint config with React/TypeScript rules. Consider adding unit tests with Jest + React Native Testing Library and E2E tests with Detox for production readiness.

---

## 📦 Building for Production

### EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login & configure
eas login
eas build:configure

# Build for all platforms
eas build --platform all

# Platform-specific
eas build --platform ios
eas build --platform android

# Preview builds (internal distribution)
eas build --profile preview --platform all
```

### Expo Updates (OTA)

```bash
# Publish update to preview channel
eas update --branch preview --message "Hotfix: chat notification fix"

# Promote to production
eas update --branch production --message "Release v1.1.0"
```

### Configuration Files
- **app.json** — Expo config (name, icons, plugins, permissions)
- **eas.json** — Build profiles (development, preview, production)
- **tsconfig.json** — Strict TypeScript with path aliases

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork** the repository
2. **Create a feature branch** — `git checkout -b feat/amazing-feature`
3. **Make changes** with clear, atomic commits
4. **Run quality checks** — `npm run lint && npx tsc --noEmit`
5. **Push** — `git push origin feat/amazing-feature`
6. **Open a Pull Request** with:
   - Clear description of changes
   - Screenshots/video for UI changes
   - Related issue number (if applicable)

### Code Style

- **TypeScript**: Strict mode, explicit types for public APIs
- **Components**: Functional components with hooks, proper `React.FC` typing
- **Naming**: PascalCase for components, camelCase for hooks/utils
- **Imports**: Absolute paths via `@/` alias (configured in tsconfig)
- **State**: Prefer React Context + hooks over external state libs for simplicity

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add skill reservation flow
fix: resolve chat notification duplicate
docs: update README with build instructions
refactor: extract feed card components
style: update theme spacing scale
test: add unit tests for auth context
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

## 🙏 Acknowledgments

- **Expo Team** — For the incredible React Native framework
- **Firebase** — For backend-as-a-service that scales
- **React Native Reanimated** — For buttery-smooth 60fps animations
- **Stitch Design** — Design system inspiration (Project: 2204805633564593254)
- **Open Source Community** — For the countless libraries that make this possible

---

## 📞 Contact & Support

| Channel | Link |
|---------|------|
| **GitHub Issues** | [Bug Reports & Feature Requests](https://github.com/ChetanDev06/CampusForge/issues) |
| **Discussions** | [Community Q&A](https://github.com/ChetanDev06/CampusForge/discussions) |
| **Author** | [ChetanDev06](https://github.com/ChetanDev06) |
| **Project** | [CampusForge Repository](https://github.com/ChetanDev06/CampusForge) |

---

<div align="center">

**Built with ❤️ for students, by students**

[⬆ Back to Top](#campusforge-⚒️)

</div>