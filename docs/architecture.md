# Architecture Overview

## System Architecture

CampusForge follows a **client-serverless** architecture with Expo/React Native on the client and Firebase as the backend-as-a-service.

### Development Environments

| Environment | Description | Use Case |
|-------------|-------------|----------|
| **Docker (Recommended)** | Containerized Node.js 20 + Expo CLI + all deps | Windows development, CI parity, zero local setup |
| **Native** | Local Node.js + Expo CLI | macOS/iOS development, native builds |

**Docker Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                        WINDOWS HOST                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Docker Desktop (WSL 2)                                 │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  campusforge-expo container                     │   │   │
│  │  │  - Node.js 20 (Bookworm slim)                  │   │   │
│  │  │  - /app (bind-mounted source)                   │   │   │
│  │  │  - /app/node_modules (anonymous volume)         │   │   │
│  │  │  - /app/.expo (anonymous volume)                │   │   │
│  │  │  - Expo CLI + Metro on 0.0.0.0:8081            │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                    │                    │             │
│    Port 8081             Port 19000-19002      Port 19006      │
│         ▼                    ▼                    ▼             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ANDROID PHONE (Expo Go)                                │   │
│  │  - Connects to Windows LAN IP:8081                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

See **[DOCKER.md](../DOCKER.md)** for complete setup guide.

### Client Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Expo/React Native)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Screens   │  │  Components │  │   Contexts  │             │
│  │  (app/)     │  │ (components)│  │ (AuthContext)            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │     Firebase SDK      │                          │
│              │  (Auth, Firestore,    │                          │
│              │   Storage, Messaging) │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────│──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Firebase Auth │ │ Cloud Firestore│ │Firebase Storage│
│  (Identity)   │ │  (Database)    │ │   (Files)     │
└───────────────┘ └───────────────┘ └───────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Cloud Messaging│ │ Cloud Functions│ │  Hosting      │
│  (Push Notifs) │ │  (Backend)     │ │  (Web Build)  │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Data Flow

### Authentication Flow

```
User → Expo App → Firebase Auth (Email/Password)
                    ↓
            OnAuthStateChanged
                    ↓
         Firestore: users/{uid} (Profile)
                    ↓
         Real-time Listener → AuthContext
                    ↓
         App State Updated → Navigation Guards
```

### Content Creation Flow

```
User Creates Post
       ↓
Client Validation (moderation.ts)
       ↓
Upload Images → Firebase Storage
       ↓
Write to Firestore (marketplace/lost_found/skills)
       ↓
Firestore Rules Validate:
  - User owns document
  - College ID matches
  - Required fields present
       ↓
Real-time Listeners → Home Feed Updates
       ↓
Push Notification → Relevant Users
```

### Chat Flow

```
User A sends message
       ↓
Write to: chats/{chatId}/messages/{messageId}
       ↓
Update: chats/{chatId} (lastMessage, unreadCount)
       ↓
Cloud Function (or Client) → FCM Push to User B
       ↓
User B receives notification
       ↓
Tap → Navigate to chat/{chatId}
       ↓
Real-time Listener → Messages Appear
```

## Key Architectural Decisions

### 1. Expo Router (File-based Routing)

**Decision**: Use Expo Router v6 for navigation.

**Rationale**:
- Type-safe routes with `typedRoutes: true`
- Deep linking out of the box
- Shared code between web and native
- Static rendering for web SEO

**Trade-offs**:
- Learning curve for React Navigation users
- Limited dynamic route patterns

### 2. React Context for State Management

**Decision**: Use React Context (`AuthContext`) instead of Redux/Zustand.

**Rationale**:
- Simpler mental model for team
- No additional dependencies
- Sufficient for current scope (auth, profile, notifications)
- Easy to migrate later if needed

**Trade-offs**:
- Re-renders on context change (mitigated with `useMemo`)
- No devtools time-travel debugging

### 3. Real-time Firestore Listeners

**Decision**: Use `onSnapshot` for real-time feeds instead of polling.

**Rationale**:
- Instant updates across devices
- Lower latency than polling
- Built-in offline support
- Automatic reconnection

**Trade-offs**:
- Higher read costs (mitigated with `limit()` and `memoryLocalCache`)
- Connection management complexity

### 4. College-Scoped Data Model

**Decision**: All user content scoped by `collegeId`.

**Rationale**:
- Privacy: Students only see their campus
- Performance: Smaller query sets
- Moderation: Easier per-college admin
- Legal: Data residency compliance

**Implementation**:
```typescript
// Every document has collegeId
interface BaseDocument {
  collegeId: string;
  userId: string;
  createdAt: Timestamp;
}

// Queries always filter
query(collection(db, 'marketplace'), where('collegeId', '==', userCollegeId))
```

### 5. Design System (constants/theme.ts)

**Decision**: Centralized design tokens with dark-first approach.

**Rationale**:
- Consistency across 50+ screens
- Easy theming (light/dark)
- Type-safe with TypeScript
- No CSS-in-JS runtime overhead

## Data Model

### Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User profiles | `uid`, `name`, `collegeId`, `email`, `avatarUrl`, `role` |
| `colleges` | College metadata | `domain`, `name`, `shortName`, `verified` |
| `lost_found` | Lost/found items | `type`, `title`, `description`, `location`, `status`, `imageUrl` |
| `marketplace` | Buy/sell listings | `title`, `price`, `condition`, `category`, `status`, `imageUrl` |
| `skills` | Skill exchange | `title`, `description`, `schedule`, `maxParticipants`, `currentParticipants` |
| `skills/{id}/reservations` | Skill reservations | `userId`, `skillId`, `status`, `createdAt` |
| `chats` | Conversations | `participants`, `lastMessage`, `lastMessageAt`, `unreadCount` |
| `chats/{id}/messages` | Chat messages | `senderId`, `text`, `createdAt`, `type` |
| `reviews` | User ratings | `reviewerId`, `revieweeId`, `rating`, `comment` |
| `notifications` | Push/local notifications | `userId`, `title`, `body`, `data`, `read` |
| `reports` | Content reports | `reporterId`, `reportedUserId`, `reason`, `status` |
| `config` | App configuration | `key`, `value`, `description` |

### Indexes Required

```javascript
// Firestore Composite Indexes (deploy via firebase deploy --only firestore:indexes)

// Lost & Found
collectionGroup: lost_found
  - collegeId ASC, status ASC, createdAt DESC
  - collegeId ASC, type ASC, createdAt DESC

// Marketplace
collectionGroup: marketplace
  - collegeId ASC, status ASC, createdAt DESC
  - collegeId ASC, category ASC, createdAt DESC

// Skills
collectionGroup: skills
  - collegeId ASC, createdAt DESC

// Chats
collectionGroup: chats
  - participants ARRAY_CONTAINS, lastMessageAt DESC

// Messages
collectionGroup: messages
  - chatId ASC, createdAt ASC

// Reviews
collectionGroup: reviews
  - revieweeId ASC, createdAt DESC

// Notifications
collectionGroup: notifications
  - userId ASC, read ASC, createdAt DESC
```

## Security Model

### Authentication
- Firebase Auth with Email/Password
- Email verification required for college email
- Custom claims for `admin` role
- Session persistence via AsyncStorage (native) / IndexedDB (web)

### Authorization (Firestore Rules)
- **Users**: Read/write own profile, create content in their college
- **College Members**: Read active content in their college
- **Admins**: Full read/write access
- **No Public Access**: All data requires authentication

### Data Validation
- Client-side: `utils/moderation.ts` (bad words, length)
- Server-side: Firestore Security Rules (schema validation)
- Cloud Functions: Complex validation (future)

## Performance Considerations

### Client-Side
- `expo-image` with `transition` prop for smooth loading
- `react-native-reanimated` worklets for 60fps animations
- `FlatList` with `getItemLayout` for large lists
- `memoryLocalCache` for Firestore offline support
- Skeleton loaders instead of spinners

### Database
- `limit(5)` on home feed listeners
- Composite indexes for common queries
- `orderBy('createdAt', 'desc')` with `limit` for pagination
- Denormalized `userName`, `participantNames` to avoid joins

### Network
- `experimentalForceLongPolling` for corporate networks
- Image optimization via Cloudinary (planned)
- OTA updates via Expo Updates for instant JS patches

## Scalability Considerations

### Current Limits
- Firestore: 1M reads/day (Spark), 10GB storage
- Firebase Auth: Unlimited users
- Cloud Functions: 2M invocations/month (Spark)
- Expo Updates: Unlimited bandwidth (with fair use)

### Growth Path
1. **Firestore**: Upgrade to Blaze plan, enable TTL for old notifications
2. **Cloud Functions**: Move heavy operations (image processing, notifications)
3. **Search**: Add Algolia/Meilisearch for full-text search
4. **Analytics**: Add BigQuery export for analytics
5. **CDN**: Cloudflare for static assets

## Future Architecture Evolution

### Planned Improvements

| Area | Current | Target |
|------|---------|--------|
| State Management | React Context | Zustand (for complex UI state) |
| Backend | Client-side Firestore | Cloud Functions for sensitive ops |
| Search | Client-side filter | Algolia/Meilisearch |
| Analytics | Firebase Analytics | BigQuery + Custom Dashboard |
| Payments | None | Stripe Connect for marketplace |
| Moderation | Client-side only | Cloud Functions + AI moderation |
| Offline | Basic Firestore cache | Full offline-first with sync queue |

---

*Last updated: January 2025*