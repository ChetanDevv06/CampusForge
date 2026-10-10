# Contributing to CampusForge

Thank you for your interest in contributing to CampusForge! This document outlines the process and guidelines for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20 (LTS) — for native development
- npm ≥ 10 or pnpm ≥ 9
- Expo CLI: `npm install -g @expo/cli`
- **Docker Desktop** ≥ 4.25 (for containerized development) — [Install](https://www.docker.com/products/docker-desktop/)
- Firebase project (for backend services)
- iOS Simulator / Android Emulator / Physical device

### Setup

#### Option A: Docker Development (Recommended)

```bash
# Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/CampusForge.git
cd CampusForge

# Configure environment
cp .env.example .env
# Add your Firebase credentials to .env

# Start development server in Docker
npm run start:docker
```

The container handles Node.js, npm, Expo CLI, and all dependencies. Source code is mounted for hot reload. See [DOCKER.md](DOCKER.md) for complete guide.

#### Option B: Native Development

```bash
# Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/CampusForge.git
cd CampusForge

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Add your Firebase credentials to .env

# Start development server
npx expo start
```

---

## Development Workflow

### Branch Naming

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/` | `feat/skill-reservation-flow` |
| Bug Fix | `fix/` | `fix/chat-notification-duplicate` |
| Documentation | `docs/` | `docs/update-readme-build-instructions` |
| Refactor | `refactor/` | `refactor/extract-feed-cards` |
| Style | `style/` | `style/update-theme-spacing` |
| Test | `test/` | `test/add-auth-context-tests` |
| Chore | `chore/` | `chore/update-dependencies` |

### Development Process

#### Using Docker (Recommended)

```bash
# 1. Create a branch from main
git checkout -b feat/your-feature-name

# 2. Make changes — hot reload works automatically

# 3. Run quality checks INSIDE the container
docker compose exec expo npm run lint
docker compose exec expo npx tsc --noEmit
# Or use npm scripts that run in container:
npm run docker:logs  # Check logs

# 4. Push to your fork
git push origin feat/your-feature-name
```

#### Using Native Development

```bash
# 1. Create a branch from main
git checkout -b feat/your-feature-name

# 2. Make atomic commits with clear messages
git add .
git commit -m "feat: add skill reservation flow"

# 3. Run quality checks before pushing
npm run lint
npx tsc --noEmit

# 4. Push to your fork
git push origin feat/your-feature-name
```

5. **Open a Pull Request** against `main`

---

## Code Standards

### TypeScript

- **Strict mode** enabled — no `any` without justification
- **Explicit types** for public APIs, component props, and context values
- **Type inference** preferred for local variables
- **Path aliases** configured: `@/` maps to project root

### React / React Native

- **Functional components** with hooks only
- **Component naming**: PascalCase (`SkillCard.tsx`)
- **Hook naming**: camelCase with `use` prefix (`useAuth.ts`)
- **File structure**:
  ```
  ComponentName/
  ├── ComponentName.tsx
  ├── ComponentName.styles.ts
  ├── ComponentName.test.tsx
  └── index.ts
  ```
- **Props interface**: `ComponentNameProps`
- **Default exports** for components

### Styling

- Use **design tokens** from `constants/theme.ts` (Colors, Typography, Spacing, Roundness, Shadows, Gradients)
- **No hardcoded values** — use `Spacing.md`, `Colors.primary`, etc.
- **Dark-first** — all colors work in dark mode; light mode mirrors dark
- **Reanimated** for animations (worklet-based, UI thread)

### File Organization

```
app/                    # Expo Router screens (file-based routing)
components/             # Reusable UI components
  ui/                   # Design system primitives
contexts/               # React Context providers
constants/              # Design tokens, config
utils/                  # Pure functions, hooks, helpers
firebaseConfig.ts       # Firebase initialization
```

### Imports

```typescript
// External packages first
import React from 'react';
import { View, Text } from 'react-native';

// Internal aliases (configured in tsconfig)
import { Colors, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

// Relative imports last
import { CustomComponent } from './CustomComponent';
```

---

## Commit Convention

Follow [Conventional Commits 1.0](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature for users |
| `fix` | Bug fix for users |
| `docs` | Documentation changes |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system changes |
| `ci` | CI configuration changes |
| `chore` | Maintenance, dependency updates |
| `revert` | Reverts a previous commit |

### Examples

```bash
feat(auth): add college email verification flow

fix(chat): resolve duplicate notification on message receive

docs(readme): update build instructions for EAS

refactor(feed): extract FeedCard into separate component

style(theme): update spacing scale to 4px base

test(auth): add unit tests for signOutUser

chore(deps): upgrade expo to 54.0.35
```

---

## Pull Request Process

### Before Submitting

- [ ] Branch is up to date with `main`
- [ ] All quality checks pass (`npm run lint && npx tsc --noEmit`)
- [ ] Commits follow conventional format
- [ ] No `console.log` or debug code in production paths
- [ ] TypeScript types are explicit for new public APIs

### PR Template

When opening a PR, include:

1. **Description**: What changes and why
2. **Type**: Feature / Bug Fix / Refactor / Docs / Other
3. **Testing**: How you verified the changes
4. **Screenshots**: For UI changes (before/after)
5. **Related Issues**: Link to issues (e.g., `Closes #123`)

### Review Process

1. **Automated checks** must pass (lint, type-check)
2. **Maintainer review** — at least one approval required
3. **Address feedback** — push follow-up commits to the same branch
4. **Squash and merge** — maintainers will squash on merge

### PR Title Format

Same as commit convention:
```
feat: add skill reservation flow
fix: resolve chat notification duplicate
```

---

## Testing

### Current Setup

- **TypeScript** compile-time checking
- **ESLint** with Expo config
- **Manual testing** on device/simulator

### Recommended (Future)

```bash
# Unit tests
npm test -- --watch

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Testing Guidelines

- Test **business logic** in `utils/` and `contexts/`
- Test **component rendering** with React Native Testing Library
- Mock **Firebase** with `@firebase/testing` or `jest-mock`
- **Snapshot test** design system components

---

## Reporting Issues

### Bug Reports

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- **Environment**: OS, Expo SDK, React Native version, Device
- **Steps to reproduce**: Minimal, clear steps
- **Expected vs actual behavior**
- **Screenshots/Video**: If applicable
- **Logs**: Metro console, Crashlytics, or device logs

### Security Issues

**Do not open public issues** for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## Feature Requests

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md):

- **Problem statement**: What user need does this solve?
- **Proposed solution**: High-level approach
- **Alternatives considered**: Why this approach?
- **Priority**: Nice-to-have / Important / Critical
- **Design references**: Figma, sketches, or similar apps

---

## Recognition

Contributors are recognized in:

- **GitHub Contributors** graph
- **Release notes** for significant contributions
- **README acknowledgments** section

---

## Questions?

- **Discussions**: [GitHub Discussions](https://github.com/ChetanDev06/CampusForge/discussions)
- **Issues**: [GitHub Issues](https://github.com/ChetanDev06/CampusForge/issues)
- **Maintainer**: [@ChetanDev06](https://github.com/ChetanDev06)

---

*Thank you for contributing to CampusForge!* ⚒️