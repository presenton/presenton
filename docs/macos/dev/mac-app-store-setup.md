# Mac App Store Setup

Presenton’s Electron app is configured for Mac App Store (MAS) distribution with App Sandbox. MAS builds must be produced on macOS because Apple’s signing tools are required.

This guide covers Apple Developer setup, local provisioning files, and the npm scripts in `electron/package.json` on `main`.

## Overview

| Target | Purpose | npm script |
|--------|---------|------------|
| `dmg` | Local install (default) | `npm run build:all` |
| `mas-dev` | Sandbox testing on registered Macs | `npm run build:all:mas-dev` |
| `mas` | App Store submission | `npm run build:all:mas` |

Build configuration lives in `electron/build.js`. Key identifiers:

- **Bundle ID:** `com.presenton.presenton`
- **Team ID:** `S6W5C54KL6` (set in `extendInfo.ElectronTeamID`)

## MAS files in the repo

These are checked in under `electron/build/`:

| File | Role |
|------|------|
| `entitlements.mas.plist` | Main app entitlements (sandbox, network, JIT, user-selected files) |
| `entitlements.mas.inherit.plist` | Inherited entitlements for helper processes and bundled binaries |
| `MacAppStore.provisionprofile.replace_me` | Placeholder — replace with your real App Store profile (see below) |

`build.js` validates provisioning profiles with `security cms -D` before building. Invalid or placeholder files will fail the build with a clear error.

## What you need from Apple

### 1. Apple Development certificate

Xcode → **Settings** → **Accounts** → your team → **Manage Certificates** → **+** → **Apple Development**.

Used for `mas-dev` builds and local sandbox testing.

### 2. Apple Distribution certificate

Same path as above, but choose **Apple Distribution**.

Used for `mas` (App Store submission) builds.

### 3. App ID (Bundle ID)

[Apple Developer Portal](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers** → **App IDs**.

Create a macOS App ID that matches `com.presenton.presenton` (or update `APP_ID` in `electron/build.js` if you use a different ID).

### 4. Provisioning profiles

Create **two** macOS profiles and download each `.provisionprofile` file into `electron/build/`:

#### AppleDevelopment (MAS development)

- Portal → **Profiles** → **+**
- Type: **macOS App Development**
- App ID: your Presenton app ID
- Certificate: **Apple Development**
- Save as `electron/build/AppleDevelopment.provisionprofile`

`build.js` also accepts `AppleDev.provisionprofile` or `AppDev.provisionprofile` as fallbacks.

#### MacAppStore (MAS distribution)

- Portal → **Profiles** → **+**
- Type: **Mac App Store**
- App ID: your Presenton app ID
- Certificate: **Apple Distribution**
- Save as `electron/build/MacAppStore.provisionprofile`

Verify profiles decode correctly:

```bash
cd electron
security cms -D -i build/AppleDevelopment.provisionprofile
security cms -D -i build/MacAppStore.provisionprofile
```

Provisioning profiles expire (typically yearly). Regenerate and replace the local files when they do.

## Environment variables

| Variable | Used for | Description |
|----------|----------|-------------|
| `PRESENTON_MAC_TARGET` | Set by npm scripts | `mas-dev` or `mas` (do not set manually when using the scripts below) |
| `PRESENTON_MAS_DEV_IDENTITY` | `mas-dev` | Signing identity, e.g. `Apple Development: Your Name (TEAMID)` |
| `PRESENTON_MAS_DISTRIBUTION_IDENTITY` | `mas` | Distribution identity, e.g. `Apple Distribution: Your Org (TEAMID)` |
| `PRESENTON_MAS_IDENTITY` | `mas` | Alias for distribution identity |
| `CSC_NAME` | Either target | Fallback if the target-specific identity vars are unset |
| `PRESENTON_APP_STORE_VERSION` | `mas` | App Store **version** (`x.y.z`). Required when `package.json` version contains a suffix like `-beta` |
| `PRESENTON_APP_STORE_BUILD` | `mas` | App Store **build** number. Defaults to the short version if unset |

Example for a beta package version:

```bash
export PRESENTON_APP_STORE_VERSION=1.0.0
export PRESENTON_APP_STORE_BUILD=42
```

## Build commands

Run from `electron/` after `npm run setup:env` (first time only).

### Full build (recommended)

Rebuilds Next.js, FastAPI, export runtime, and packages the app:

```bash
# MAS development — runs on Macs in your dev provisioning profile
PRESENTON_MAS_DEV_IDENTITY="Apple Development: Your Name (TEAMID)" \
  npm run build:all:mas-dev

# MAS distribution — for App Store Connect upload
PRESENTON_MAS_DISTRIBUTION_IDENTITY="Apple Distribution: Your Org (TEAMID)" \
  PRESENTON_APP_STORE_VERSION=1.0.0 \
  npm run build:all:mas
```

### Package only (resources already built)

If you already ran `build:all` and only need to re-run the Electron packager:

```bash
PRESENTON_MAS_DEV_IDENTITY="Apple Development: Your Name (TEAMID)" \
  npm run dist:mac:mas-dev

PRESENTON_MAS_DISTRIBUTION_IDENTITY="Apple Distribution: Your Org (TEAMID)" \
  PRESENTON_APP_STORE_VERSION=1.0.0 \
  npm run dist:mac:mas
```

### Default DMG (not App Store)

For a standard macOS disk image (no sandbox, no MAS signing):

```bash
npm run build:all
```

Artifacts land in `electron/dist/`.

## Output locations

Exact paths depend on architecture (`arm64` vs `x64`). Typical layouts:

```text
electron/dist/
  mas-dev-arm64/          # unsigned or dev-signed .app (mas-dev)
  mas-arm64/              # distribution-signed .app (mas)
  Presenton-<version>.pkg # MAS installer for upload
  Presenton-<version>.dmg # local DMG (default target)
```

Upload the `.pkg` from the `mas` build to [App Store Connect](https://appstoreconnect.apple.com).

## Icons

The default macOS icon is `electron/resources/ui/assets/images/presenton_short_filled.png`.

For App Store packaging you can provide a proper `.icns` at `electron/build/icon.icns` and update the `mac.icon` field in `electron/build.js` if you want a custom store icon.

Source PNGs for generating an icon set are in `electron/build/icon.iconset/`.

## Testing notes

- **MAS-signed apps** require the MAS Electron build (`mas` or `mas-dev` targets). A normal DMG build is not sandbox-compatible in the same way.
- **`mas-dev` builds** run only on Macs registered in your development provisioning profile.
- **`mas` (distribution) builds** usually do not launch locally; they are meant for App Store Connect processing and release.
- **`mas-dev` signing** uses `--timestamp=none` in `build.js` so local signing works without a network timestamp server.

## Troubleshooting

**“Missing MAS development/distribution provisioning profile”**

Place the correct `.provisionprofile` in `electron/build/` (see [Provisioning profiles](#4-provisioning-profiles)).

**“macOS could not decode” a profile**

Re-download the profile from the Developer Portal. Do not commit real profiles to git.

**“Cannot derive an App Store version from package version”**

Set `PRESENTON_APP_STORE_VERSION` to three integers, e.g. `1.0.0`.

**“MAS builds must be run on macOS”**

Run the build on a Mac with Xcode command-line tools installed (`xcode-select --install`).

**FastAPI or export binary not executable inside the .app**

`build.js` runs an `afterPack` hook that sets executable permissions on bundled binaries. If signing fails afterward, check that entitlements allow the sandboxed app to execute helpers in `Contents/Resources/app/resources/`.

## See also

- [macOS dev README](./README.md) — quick reference for all macOS build targets
- [Electron dependency strategy](../../electron-dependency-strategy.md) — what gets bundled in the app
