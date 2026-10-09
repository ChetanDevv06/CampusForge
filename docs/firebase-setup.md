# Firebase Setup Guide

## Project Creation

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Name: `CampusForge` (or your preferred name)
4. Enable **Google Analytics** (optional but recommended)
5. Create project

## Enable Services

### Authentication
1. **Authentication** → **Sign-in method** → **Email/Password** → Enable
2. **Settings** → **Authorized domains** → Add:
   - `localhost`
   - Your production domain (e.g., `campusforge.app`)
   - `*.expo.dev` (for Expo web preview)

### Firestore Database
1. **Firestore Database** → **Create database**
2. **Start in production mode** (we'll deploy rules)
3. Choose location (closest to your users)

### Storage
1. **Storage** → **Get started**
2. **Production mode**
3. Same location as Firestore

### Cloud Messaging
1. **Messaging** → **Get started**
2. Configure for iOS/Android (see below)

## Platform Configuration

### iOS
1. **Project Settings** → **General** → **Add app** → **iOS**
2. Bundle ID: `com.campusforge.app` (matches `app.json`)
3. Download `GoogleService-Info.plist`
4. Place in project root (gitignored)
5. **Cloud Messaging** → **APNs** → Upload `.p8` key from Apple Developer

### Android
1. **Project Settings** → **General** → **Add app** → **Android**
2. Package name: `com.campusforge.app` (matches `app.json`)
3. Download `google-services.json`
4. Place in project root (gitignored)
5. **Cloud Messaging** → **FCM** → Server key auto-configured

### Web
1. **Project Settings** → **General** → **Add app** → **Web**
3. Nickname: `CampusForge Web`
4. Copy config values for `.env`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required - from Firebase Console > Project Settings > General > Your apps > Web App
EXPO_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="campusforge.firebaseapp.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="campusforge"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="campusforge.appspot.com"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
EXPO_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Optional - Cloudinary for image optimization
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="123456789"
CLOUDINARY_API_SECRET="abcdef"
```

## Security Rules Deployment

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes (after creating composite indexes in console)
firebase deploy --only firestore:indexes
```

## Firestore Rules Testing

```bash
# Start emulator
firebase emulators:start --only firestore

# Run tests (create test file)
# See: https://firebase.google.com/docs/firestore/security/test-rules-emulator
```

## Cloud Functions (Future)

For server-side logic:
```bash
firebase init functions
# Choose TypeScript
# Deploy: firebase deploy --only functions
```

## App Check (Recommended)

1. **App Check** → **Get started**
2. Register each platform:
   - iOS: **App Attest** / **DeviceCheck**
   - Android: **Play Integrity**
   - Web: **reCAPTCHA v3**
3. Enforce for: **Firestore**, **Storage**, **Functions**

## Extensions (Optional)

Useful Firebase Extensions:
- **Trigger Email** - Send emails via SendGrid/Mailgun
- **Resize Images** - Auto-resize Storage uploads
- **Delete User Data** - GDPR compliance
- **Firestore BigQuery Export** - Analytics

## Monitoring & Alerts

1. **Crashlytics** → Enable (already in `package.json`)
2. **Performance Monitoring** → Enable
3. **Alerts** → Set up for:
   - Crash-free users < 99%
   - Firestore read/write errors > 1%
   - Auth failures > 5%

## Backup & Restore

```bash
# Export (manual)
gcloud firestore export gs://your-bucket/backups/$(date +%Y%m%d)

# Import
gcloud firestore import gs://your-bucket/backups/20241215

# Automated: Use Cloud Scheduler + Cloud Functions
```

## Cost Optimization

| Service | Free Tier | Optimization |
|---------|-----------|--------------|
| Firestore | 50K reads/day | `limit()`, `memoryLocalCache`, composite indexes |
| Auth | 50K MAU | N/A |
| Storage | 5 GB | Cloudinary transformations, cleanup old files |
| Functions | 2M invocations | Batch operations, avoid cold starts |
| Messaging | Unlimited | Targeted notifications only |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `permission-denied` | Check `firestore.rules`, ensure user has `collegeId` |
| `unauthenticated` | Verify Auth state listener in `AuthContext` |
| Storage CORS errors | Configure CORS on bucket: `gsutil cors set cors.json gs://bucket` |
| Push not received | Check FCM token, APNs key, `google-services.json` placement |
| Web: `auth/unauthorized-domain` | Add domain to Firebase Auth authorized domains |

## Useful Commands

```bash
# View project config
firebase projects:list

# Switch project
firebase use campusforge

# View deployed rules
firebase firestore:rules:get

# Emulator suite
firebase emulators:start

# Logs
firebase functions:log

# Database backup
firebase firestore:backups:schedule --database=default --daily --retention=30d
```

---

*Last updated: January 2025*