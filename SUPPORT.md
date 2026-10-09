# Support

## Getting Help

### Before Asking

1. **Search existing issues** — [GitHub Issues](https://github.com/ChetanDev06/CampusForge/issues)
2. **Check discussions** — [GitHub Discussions](https://github.com/ChetanDev06/CampusForge/discussions)
3. **Review documentation** — [README](README.md), [Contributing](CONTRIBUTING.md)
4. **Verify environment** — Node.js ≥ 20, Expo CLI latest, Firebase project configured

---

## Support Channels

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| **GitHub Issues** | Bug reports, feature requests | 1-3 business days |
| **GitHub Discussions** | Questions, ideas, community help | Community-driven |
| **Security Email** | Vulnerability reports only | ≤ 48 hours |
| **Maintainer DM** | Urgent/private matters | Best effort |

### GitHub Issues

Use the appropriate template:

- 🐛 **[Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)** — Something isn't working
- ✨ **[Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)** — New capability needed
- 📚 **[Documentation](.github/ISSUE_TEMPLATE/documentation.md)** — Docs improvement
- ❓ **[Question](.github/ISSUE_TEMPLATE/question.md)** — How-to / clarification

### GitHub Discussions

Best for:
- Architecture/design questions
- "How do I...?" questions
- Community showcase
- General feedback

---

## Common Issues & Solutions

### Installation Problems

| Issue | Solution |
|-------|----------|
| `npm install` fails | Delete `node_modules`, `package-lock.json`, run `npm cache clean --force`, retry |
| Metro bundler won't start | `npx expo start --clear` |
| iOS Simulator not opening | Xcode → Preferences → Locations → Command Line Tools set |
| Android build fails | `cd android && ./gradlew clean && cd .. && npx expo run:android` |

### Firebase Configuration

| Issue | Solution |
|-------|----------|
| "Auth domain not authorized" | Add `localhost` and your domain to Firebase Console → Authentication → Settings → Authorized domains |
| "Permission denied" on Firestore | Deploy rules: `firebase deploy --only firestore:rules` |
| Storage upload fails | Check Storage rules, ensure bucket exists, verify CORS config |
| Push notifications not received | Verify `google-services.json` / `GoogleService-Info.plist`, check FCM token registration |

### Expo / Runtime

| Issue | Solution |
|-------|----------|
| "Module not found" errors | `npx expo install --fix` then `npx expo start --clear` |
| Font not loading | Ensure `useFonts` hook in `_layout.tsx`, check font names match `@expo-google-fonts/*` |
| Reanimated not working | Add `'react-native-reanimated/plugin'` to `babel.config.js`, restart Metro |
| White screen on device | Check Metro logs, verify `app.json` scheme matches deep links |

### TypeScript / Lint

| Issue | Solution |
|-------|----------|
| Type errors after upgrade | `npx tsc --noEmit` to see all, fix incrementally |
| ESLint errors | `npm run lint -- --fix` for auto-fixable |
| Path alias not resolving | Check `tsconfig.json` `paths`, restart TS server (VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server") |

---

## FAQ

### General

**Q: Is CampusForge open source?**
A: Yes, MIT licensed. See [LICENSE](LICENSE).

**Q: Can I use this for my university?**
A: Absolutely! Fork, configure your Firebase project, and deploy.

**Q: Does it support multiple colleges?**
A: Yes, each user belongs to one `collegeId`. Content is scoped to that community.

**Q: Is there a web version?**
A: Yes, run `npx expo start --web` or visit the deployed Expo web build.

### Development

**Q: How do I add a new screen?**
A: Create file in `app/` (e.g., `app/new-screen.tsx`). Expo Router auto-generates route.

**Q: How do I add a new Firestore collection?**
A: 1. Define TypeScript interface in relevant file 2. Add Firestore rules 3. Create utility functions in `utils/` 4. Use in components via `db` from `firebaseConfig.ts`

**Q: How do I customize the theme?**
A: Edit `constants/theme.ts` — colors, typography, spacing, gradients, shadows all defined there.

**Q: Can I use Redux/Zustand instead of Context?**
A: Current architecture uses React Context for simplicity. PRs welcome but must justify added complexity.

### Deployment

**Q: How do I deploy to App Store / Play Store?**
A: `eas build --platform all --profile production` → download binaries → submit via App Store Connect / Play Console.

**Q: How do OTA updates work?**
A: `eas update --branch production` pushes JS bundle to users instantly. Native changes require new build.

**Q: Can I self-host the backend?**
A: Firebase is BaaS. For self-hosted, you'd need to replace Auth/Firestore/Storage/Functions with alternatives (Supabase, AppWrite, PocketBase, custom).

---

## Contributing to Support

Help improve support by:

- **Answering questions** in Discussions
- **Improving docs** via PRs to README/CONTRIBUTING
- **Creating templates** for common issues
- **Translating** documentation

---

## Service Level Expectations

| Request Type | Initial Response | Resolution Target |
|--------------|------------------|-------------------|
| Critical bug (data loss, security) | ≤ 24 hours | ≤ 7 days |
| Major bug (feature broken) | ≤ 48 hours | ≤ 14 days |
| Minor bug (UI glitch, annoyance) | ≤ 1 week | Next release |
| Feature request | ≤ 1 week | Roadmap planning |
| Documentation | ≤ 1 week | Next release |

> **Note**: This is an open-source project maintained voluntarily. Response times are targets, not guarantees.

---

## Resources

| Resource | Link |
|----------|------|
| **Expo Documentation** | https://docs.expo.dev |
| **React Native Docs** | https://reactnative.dev |
| **Firebase Docs** | https://firebase.google.com/docs |
| **TypeScript Handbook** | https://www.typescriptlang.org/docs |
| **EAS Build Docs** | https://docs.expo.dev/build/introduction/ |
| **Expo Router Docs** | https://docs.expo.dev/router/introduction/ |

---

## Maintainer Availability

- **Primary**: [@ChetanDev06](https://github.com/ChetanDev06)
- **Timezone**: UTC+5:30 (IST)
- **Typical hours**: Weekdays 10:00–19:00 IST

---

*Last updated: January 2025*