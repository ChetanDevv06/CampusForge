# Docker Development Environment for CampusForge

This guide explains how to use Docker for developing the CampusForge Expo application on Windows.

## Prerequisites

1. **Docker Desktop for Windows** (v4.25+)
   - Download: https://www.docker.com/products/docker-desktop/
   - Enable **WSL 2 backend** during installation (recommended)
   - Ensure virtualization is enabled in BIOS/UEFI

2. **WSL 2** with a Linux distribution (Ubuntu recommended)
   - `wsl --install` in PowerShell (Admin)
   - Restart after installation

3. **Git for Windows**
   - Download: https://git-scm.com/download/win

4. **Physical Android Device** with Expo Go installed
   - Download Expo Go from Play Store

## Quick Start

### 1. Clone and Configure

```powershell
# Clone the repository (if not already done)
git clone <repository-url>
cd CampusForge

# Copy environment template and fill in your credentials
cp .env.example .env
# Edit .env with your actual API keys (see Environment Variables section)
```

### 2. Build and Start Container

```powershell
# Build and start in foreground (see logs directly)
npm run start:docker

# OR build and start in background
npm run start:docker:detached
npm run docker:logs  # View logs
```

### 3. Connect Expo Go on Android

When the container starts, you'll see a QR code and URLs like:

```
Metro waiting on http://localhost:8081
QR code: exp://192.168.1.XX:8081
```

**On your Android phone:**
1. Open Expo Go app
2. Tap "Scan QR Code" and scan the QR code from terminal
3. OR manually enter the `exp://` URL shown in logs

## Environment Variables

Create `.env` from `.env.example` with your actual credentials:

```powershell
cp .env.example .env
notepad .env  # Edit with your values
```

**Required variables:**
| Variable | Source |
|----------|--------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console > Project Settings > Web App |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console > Project Settings > Web App |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console > Project Settings |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console > Storage |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console > Project Settings > Cloud Messaging |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Console > Project Settings > Web App |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google AI Studio (https://aistudio.google.com/) |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Dashboard |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Dashboard > Upload Presets |

**Security Note:** These are `EXPO_PUBLIC_*` variables, meaning they are embedded in the client bundle. Never put server-only secrets (service account keys, admin SDK credentials) in these variables.

## Networking: Connecting Android Device

### LAN Mode (Default, Recommended)

The container starts with `--lan` flag. This works when:
- Windows PC and Android phone are on the **same Wi-Fi network**
- Windows Firewall allows inbound connections on ports 8081, 19000-19002

**To verify connectivity:**
```powershell
# On Windows, find your LAN IP
ipconfig | findstr "IPv4"

# Test from phone browser: http://<YOUR_WINDOWS_IP>:8081
# Should show "Metro Bundler" or similar
```

**Windows Firewall Setup:**
```powershell
# Run in PowerShell as Administrator
New-NetFirewallRule -DisplayName "Expo Metro" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Expo DevTools" -Direction Inbound -LocalPort 19000-19002 -Protocol TCP -Action Allow
```

### Tunnel Mode (When LAN Doesn't Work)

If LAN mode fails (different subnets, corporate network, etc.):

```powershell
# Stop current container
npm run docker:stop

# Start with tunnel mode (requires expo account login)
docker compose run --rm -e EXPO_USE_TUNNEL=true expo npx expo start --tunnel --clear
```

**Note:** Tunnel mode requires an Expo account (`npx expo login`) and may be slower.

### Finding the Correct Address

The QR code in Docker may show `localhost` or container IP. Use your **Windows host LAN IP** instead:

1. Run `ipconfig` in PowerShell
2. Find `IPv4 Address` under your Wi-Fi adapter (e.g., `192.168.1.42`)
3. In Expo Go, manually enter: `exp://192.168.1.42:8081`

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run start:docker` | Build and start container (foreground) |
| `npm run start:docker:detached` | Build and start container (background) |
| `npm run docker:logs` | Follow container logs |
| `npm run docker:stop` | Stop and remove container |
| `npm run docker:rebuild` | Full rebuild (clears volumes, reinstalls deps) |
| `npm run docker:clean` | Remove container, volumes, images |
| `npm run doctor` | Validate Expo configuration |
| `npm run deps:check` | Check dependency compatibility |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Development Workflow

### Hot Reload
- Source code is mounted at `/app` in container
- Changes to `.tsx`, `.ts`, `.js` files trigger Metro hot reload
- No container rebuild needed for code changes

### Adding Dependencies
```powershell
# Add a new package
docker compose exec expo npm install <package-name>

# Or rebuild to update package-lock.json and image
npm run docker:rebuild
```

### Clearing Cache
```powershell
# Clear Expo/Metro cache inside container
docker compose exec expo npx expo start --clear

# Or full clean rebuild
npm run docker:rebuild
```

### Running Expo Commands in Container
```powershell
# Open shell in container
docker compose exec expo sh

# Run any expo command
docker compose exec expo npx expo install <package>
docker compose exec expo npx expo-doctor
```

## Troubleshooting

### Container Won't Start
```powershell
# Check logs
npm run docker:logs

# Common issues:
# 1. Port conflicts - stop other Expo/Metro instances
# 2. Missing .env file - copy from .env.example
# 3. Docker Desktop not running
```

### Metro Not Accessible from Phone
1. Verify same Wi-Fi network (not guest network)
2. Check Windows Firewall rules (see above)
3. Try phone browser: `http://<WINDOWS_IP>:8081` - should show Metro status
4. Disable VPN on both devices
5. Try tunnel mode as fallback

### "Cannot find module" Errors
```powershell
# Reinstall dependencies
npm run docker:rebuild
```

### File Watching Not Working
- Ensure source is on Windows filesystem (not WSL/Linux mount)
- Try: `docker compose exec expo npx expo start --clear`
- Consider using Watchman (uncomment in compose.yaml)

### Google Services / Native Builds
The `google-services.json` is excluded from Docker (in `.dockerignore`).
For native Android builds (`expo run:android`), you need:
1. Place `google-services.json` in project root on host
2. It will be mounted via source volume
3. Run native build on host, not in Docker:
   ```powershell
   npm run android  # Runs on host with local Android SDK
   ```

## Returning to Native Windows Development

```powershell
# Stop Docker
npm run docker:stop

# Run directly on Windows (requires Node.js, npm, Expo CLI installed)
npm install
npm start
```

## Known Limitations

| Limitation | Details |
|------------|---------|
| **Native Android builds** | `expo run:android` requires Android SDK on host. Run natively on Windows. |
| **iOS development** | Not supported on Windows (requires macOS) |
| **Bluetooth/USB debugging** | Limited in container. Use host for device debugging. |
| **Push notifications testing** | Requires physical device + Expo Go + proper credentials |
| **File watcher limits** | Large projects may hit inotify limits. See Watchman note. |
| **Performance** | Slight overhead vs native. Acceptable for development. |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Windows Host                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Docker Desktop (WSL 2)                             │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  campusforge-expo container                 │   │   │
│  │  │  - Node.js 20                               │   │   │
│  │  │  - /app (mounted source)                    │   │   │
│  │  │  - /app/node_modules (anonymous volume)     │   │   │
│  │  │  - /app/.expo (anonymous volume)            │   │   │
│  │  │  - Expo CLI + Metro on 0.0.0.0:8081         │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                    │                    │         │
│    Port 8081             Port 19000-19002      Port 19006  │
│         ▼                    ▼                    ▼         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Android Phone (Expo Go)                            │   │
│  │  - Connects to Windows LAN IP:8081                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Validation Checklist

After setup, verify:

- [ ] `docker compose config` validates without errors
- [ ] `npm run start:docker` starts container successfully
- [ ] Metro logs show "Waiting on http://0.0.0.0:8081"
- [ ] `http://localhost:8081` shows Metro bundler in browser
- [ ] `http://<WINDOWS_IP>:8081` accessible from phone browser
- [ ] Expo Go on Android loads app via QR code or manual URL
- [ ] Hot reload works when editing source files
- [ ] `npm run doctor` passes inside container
- [ ] `npm run deps:check` passes inside container

## Support

If you encounter issues:

1. Check `npm run docker:logs` for error messages
2. Run `npm run doctor` inside container: `docker compose exec expo npx expo-doctor`
3. Verify `.env` has all required variables
4. Ensure Docker Desktop has enough resources (4GB+ RAM recommended)
5. Check Windows Firewall and network isolation settings

For Expo-specific issues, see: https://docs.expo.dev/