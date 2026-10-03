# Security Policy

## Supported Versions

CampusForge follows a **rolling release** model with Expo SDK. Security updates are applied to the latest release branch.

| Version | Supported | Notes |
|---------|-----------|-------|
| `main` (latest) | ✅ Yes | Active development branch |
| Expo SDK 54 | ✅ Yes | Current stable |
| Expo SDK 53 | ⚠️ Limited | Critical fixes only |
| < Expo SDK 53 | ❌ No | End of life |

> **Note**: Mobile apps receive security updates via **Expo Updates (OTA)**. Users on the latest app version automatically receive patches without app store review delays.

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### Responsible Disclosure

If you discover a security vulnerability, please report it **privately** via:

**Email**: security@campusforge.app

Or use GitHub's **Private Vulnerability Reporting** (Security tab → Report a vulnerability).

### What to Include

Provide as much detail as possible:

- **Description** of the vulnerability
- **Impact assessment** (what data/systems are at risk)
- **Steps to reproduce** (minimal reproduction)
- **Affected components** (files, APIs, Firebase rules, etc.)
- **Suggested fix** (if you have one)
- **Your contact info** for follow-up

### Response Timeline

| Severity | Acknowledgment | Assessment | Fix Target |
|----------|----------------|------------|------------|
| **Critical** (RCE, data breach, auth bypass) | ≤ 24 hours | ≤ 72 hours | ≤ 7 days |
| **High** (privilege escalation, PII exposure) | ≤ 48 hours | ≤ 1 week | ≤ 14 days |
| **Medium** (information disclosure, DoS) | ≤ 1 week | ≤ 2 weeks | ≤ 30 days |
| **Low** (minor info leak, cosmetic) | ≤ 2 weeks | ≤ 1 month | Next release |

We will:
1. **Acknowledge** receipt within the timeline above
2. **Assess** the vulnerability and determine severity
3. **Coordinate** a fix with you (if desired)
4. **Release** a patch via OTA update + app store build
5. **Credit** you in the security advisory (if desired)

---

## Security Architecture

### Authentication & Authorization

- **Firebase Auth** — Email/password with email verification
- **Custom claims** — Role-based access (`admin`, `user`)
- **College verification** — Domain-allowlist + email verification
- **Session persistence** — React Native AsyncStorage (native), IndexedDB (web)
- **Token refresh** — Automatic via Firebase SDK

### Data Protection

| Layer | Implementation |
|-------|----------------|
| **Transport** | TLS 1.3 (Firebase, Cloudinary, all APIs) |
| **At rest** | Firestore encryption (Google-managed keys) |
| **Client-side** | No sensitive data in AsyncStorage (tokens only) |
| **PII minimization** | Only required fields collected (name, email, college) |

### Firestore Security Rules

```javascript
// Key principles enforced:
// 1. Users can only read/write their own profile
// 2. Content scoped to collegeId (community isolation)
// 3. Admins have elevated permissions
// 4. Rate limiting via Cloud Functions (planned)
```

See [`firestore.rules`](firestore.rules) for current rules.

### Network Security

- **Certificate pinning** — Not currently implemented (Expo limitation)
- **API keys** — Stored in `.env` (gitignored), accessed via `process.env`
- **Firebase config** — Public values only (apiKey, authDomain, projectId)
- **Cloudinary** — Upload preset (unsigned) for client uploads; signed for admin

### Third-Party Dependencies

- **Audit**: `npm audit` run in CI
- **Updates**: Dependabot alerts + monthly manual review
- **Supply chain**: Lockfile (`package-lock.json`) committed
- **Overrides**: Used for transitive dependency pinning (see `package.json`)

---

## Secure Development Practices

### For Contributors

1. **Never commit secrets** — Use `.env` (gitignored)
2. **Validate all inputs** — Client + server (Firestore rules)
3. **Sanitize user content** — `utils/moderation.ts` for text; Cloudinary transformations for images
4. **Principle of least privilege** — Firestore rules, Cloud Functions IAM
5. **Error handling** — No stack traces to users; log server-side only

### Code Review Checklist

- [ ] No hardcoded API keys, tokens, or secrets
- [ ] Input validation on all user-facing forms
- [ ] Firestore rules updated for new collections/fields
- [ ] No `console.log` of sensitive data (tokens, PII)
- [ ] Dependencies reviewed for known vulnerabilities
- [ ] TypeScript strict mode — no `any` without comment

---

## Incident Response

### If a Breach is Suspected

1. **Contain** — Revoke compromised credentials, disable affected features
2. **Assess** — Determine scope (users, data, systems)
3. **Notify** — Affected users, Firebase/Expo support, authorities (if required)
4. **Remediate** — Patch vulnerability, rotate keys, audit logs
5. **Document** — Post-incident report (internal + public summary)

### Key Contacts

| Role | Contact |
|------|---------|
| Security Lead | security@campusforge.app |
| Firebase Project | Firebase Console → Project Settings |
| Expo Project | Expo Dashboard → Project |
| Domain/SSL | Vercel/Cloudflare Dashboard |

---

## Security Headers (Web)

For the web build (`expo start --web`), the following headers are configured via `expo` static output:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com;` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` |

---

## Compliance & Standards

| Standard | Status |
|----------|--------|
| **OWASP Mobile Top 10** | Addressed (M1-M10) |
| **OWASP API Top 10** | Addressed (API1-API10) |
| **GDPR** | Data minimization, right to delete (planned) |
| **CCPA** | No sale of personal data |
| **SOC 2** | Firebase/Expo infrastructure certified |

---

## Bug Bounty

CampusForge does not currently offer a formal bug bounty program. However, we recognize security researchers in our **Security Hall of Fame** (README) and provide:

- **Public acknowledgment** (with permission)
- **Swag** (stickers, shirts) for valid reports
- **Priority support** for future issues

---

## Security Resources

- [Firebase Security Checklist](https://firebase.google.com/docs/projects/checklists/security)
- [Expo Security Best Practices](https://docs.expo.dev/security/overview/)
- [React Native Security](https://reactnative.dev/docs/security)
- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-01-15 | 1.0.0 | Initial security policy |
| 2024-06-01 | 1.1.0 | Added OTA update process, compliance table |
| 2025-01-20 | 1.2.0 | Updated for Expo SDK 54, Firebase v12 |

---

**Last Updated**: January 2025  
**Next Review**: July 2025  
**Contact**: security@campusforge.app