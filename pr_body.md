## Summary

This PR delivers a complete documentation overhaul and establishes project governance for CampusForge. It includes a rewritten README with comprehensive technical documentation, project governance files (CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, CHANGELOG), technical documentation (architecture, Firebase setup), Firestore security rules, and GitHub automation (CI/CD workflows, Dependabot, PR/Issue templates, CODEOWNERS).

## Changes

### 📚 Documentation Rewrite
- **README.md**: Complete rewrite with tech badges, architecture overview, tech stack table, quick start guide, environment setup, platform-specific commands, auth flow, design system docs, technical highlights, testing commands, production build guide, and contributing guidelines with conventional commits

### 📋 Project Governance
- **CHANGELOG.md**: Version history following Keep a Changelog format
- **CODE_OF_CONDUCT.md**: Contributor Covenant 2.1 for inclusive community standards
- **CONTRIBUTING.md**: Development workflow, code style guide, and commit conventions
- **SECURITY.md**: Vulnerability reporting policy with supported versions
- **SUPPORT.md**: Support channels, FAQ, and troubleshooting guide
- **LICENSE**: MIT License for open source distribution

### 🏗 Technical Documentation
- **docs/architecture.md**: System architecture, data models, component relationships
- **docs/firebase-setup.md**: Step-by-step Firebase configuration guide
- **docs/README.md**: Documentation index

### 🔐 Security & Configuration
- **firestore.rules**: Comprehensive security rules for all collections (users, marketplace, lost/found, skills, chats, notifications, colleges, ratings, admin)
- **.env.example**: Improved Firebase config, removed hardcoded credentials, added optional services (Cloudinary, Sentry, Amplitude) as commented examples

### 🧹 Repository Hygiene
- **.gitignore**: Complete overhaul with organized sections for Expo, native, Metro, environment, IDE, OS, logs, testing, TypeScript, builds, package managers, and project-specific patterns
- Removed backup configs (app.config.backup.js), test artifacts (testsprite_tests/), TypeScript output files (tsc_output*.txt), and garbage file

### ⚙️ GitHub Automation
- **.github/workflows/ci.yml**: CI pipeline with type-checking, linting, and test execution
- **.github/workflows/release.yml**: Automated EAS builds on version tags
- **.github/dependabot.yml**: Weekly dependency updates for npm and GitHub Actions
- **.github/PULL_REQUEST_TEMPLATE.md**: Structured PR template with checklist
- **.github/ISSUE_TEMPLATE/**: Four templates (bug, feature, docs, question)
- **.github/CODEOWNERS**: Automatic reviewer assignment

## Testing

- All TypeScript types pass: `npx tsc --noEmit` ✓
- ESLint passes: `npm run lint` ✓
- No breaking changes to runtime code
- Configuration changes only

## Risk Assessment

- **Low risk**: Documentation, configuration, and governance changes only
- **No runtime behavior changes**: No modifications to application logic
- **Security improvement**: Removed hardcoded credentials from .env.example
- **CI/CD**: New workflows will run on future PRs to catch issues early

## Deployment Notes

- No deployment required for this PR
- New CI workflow will run on subsequent PRs
- Dependabot will create weekly update PRs
- Firestore rules should be deployed via Firebase Console after merge

## Related Issues

- Implements project governance standards
- Addresses missing documentation for onboarding contributors
- Establishes security baseline with Firestore rules