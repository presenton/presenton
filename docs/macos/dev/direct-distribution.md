# macOS Direct Distribution

Use this guide to ship Presenton as a signed and notarized macOS app outside the Mac App Store. This is the correct path for a downloadable DMG from GitHub Releases or presenton.ai.

This is not a Mac App Store build. Do not use MAS provisioning profiles, App Store Connect upload, or App Review for this flow.

If you are building from a Mac that is already registered in Apple Developer, that is fine, but the registration is not what makes the public DMG trusted. Registered devices are for development provisioning and MAS-style testing. Public direct distribution requires a Developer ID Application certificate and Apple notarization.

## What This Produces

The signed release build creates:

```text
electron/dist/
  Presenton-<version>.dmg
```

Users should be able to open the DMG and launch Presenton without macOS warning that the app is from an unidentified developer.

## How This Differs From MAS

| Area | Direct distribution | Mac App Store |
|------|---------------------|---------------|
| Certificate | Developer ID Application | Apple Distribution / 3rd Party Mac Developer |
| Provisioning profile | Not used | Required |
| App Sandbox | Not required by this build | Required |
| Notarization | Required | App Store processing handles distribution review |
| Output | DMG for download | PKG for App Store Connect |

The MAS guide in the referenced gist is still useful for the Apple Developer account and signing concepts, but this repo's direct distribution flow deliberately stops before MAS provisioning and App Store submission.

## Repository Configuration

Direct macOS distribution is configured in `electron/build.js`:

- `mac.hardenedRuntime` is enabled for non-MAS macOS builds.
- `mac.entitlements` uses `electron/build/entitlements.mac.plist`.
- `mac.entitlementsInherit` uses `electron/build/entitlements.mac.inherit.plist`.
- `mac.notarize` is enabled unless `PRESENTON_SKIP_NOTARIZATION=1`.
- `dmg.sign` is disabled because the app bundle is signed and notarized; signing the DMG itself is not required.

Use the full release build in `electron/package.json`:

```bash
npm run build:all:mac:signed
```

`build:electron:mac:signed` and `dist:mac:signed` are packaging-only reruns. Use them only after `resources/fastapi`, `resources/nextjs`, and `app_dist/` are already current. The packager checks for those generated resources before signing so it cannot produce a notarized app with missing bundled servers.

The `:mac:signed` scripts set `PRESENTON_REQUIRE_MAC_SIGNING=1`, so they fail before packaging if a Developer ID certificate or notarization credentials are missing.

## Exact Setup For A Release Mac

Run this once on the Mac that will build releases.

### 1. Install Apple Command Line Tools

```bash
xcode-select --install
xcrun notarytool --version
```

`notarytool` must be available. If it is missing, install or update Xcode.

### 2. Install The Developer ID Certificate

In Xcode:

1. Open **Xcode** -> **Settings** -> **Accounts**.
2. Select the Apple Developer team.
3. Click **Manage Certificates**.
4. Click **+**.
5. Select **Developer ID Application**.

Do not choose **Apple Development** for public distribution. Do not choose **Apple Distribution** unless you are building for the Mac App Store. For a downloadable DMG, the certificate must be **Developer ID Application**.

Confirm the certificate is visible to `codesign`:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Expected shape:

```text
Developer ID Application: Your Company Name (TEAMID)
```

Most release Macs only have one Developer ID Application certificate, so you usually do not need to export a signing identity. If multiple Developer ID certificates are installed, set the exact identity before building:

```bash
export PRESENTON_MAC_SIGN_IDENTITY="Developer ID Application: Your Company Name (TEAMID)"
```

### 3. Store Notarization Credentials Once

Create an app-specific password for the Apple ID, then store notarization credentials in the local Keychain:

```bash
xcrun notarytool store-credentials "presenton-notary" \
  --apple-id "apple-id@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

After that, the only notarization environment variable needed for normal local release builds is:

```bash
export APPLE_KEYCHAIN_PROFILE="presenton-notary"
```

To avoid exporting it manually every shell session, add it to your shell profile:

```bash
echo 'export APPLE_KEYCHAIN_PROFILE="presenton-notary"' >> ~/.zshrc
source ~/.zshrc
```

If you store the profile in a non-default keychain, also set:

```bash
export APPLE_KEYCHAIN="/path/to/keychain"
```

Do not commit notarization credentials, app-specific passwords, `.p8` keys, or real certificates to the repo.

## Build A Signed DMG

After the one-time setup, a normal release build is:

```bash
cd electron
npm run build:all:mac:signed
```

If `APPLE_KEYCHAIN_PROFILE` is not in your shell profile, run it inline:

```bash
cd electron
APPLE_KEYCHAIN_PROFILE="presenton-notary" npm run build:all:mac:signed
```

For the very first build on a fresh checkout, run setup first:

```bash
cd electron
npm run setup:env
npm run build:all:mac:signed
```

If the app resources are already built and you only need to re-run Electron packaging:

```bash
cd electron
npm run dist:mac:signed
```

The signed DMG is written to `electron/dist/`.

## What You Do Not Need

For public direct distribution, you do not need:

- A registered test device.
- A `.provisionprofile` file.
- `PRESENTON_MAS_DEV_IDENTITY`.
- `PRESENTON_MAS_DISTRIBUTION_IDENTITY`.
- `PRESENTON_APP_STORE_VERSION`.
- App Store Connect upload.
- App Review approval.

Those are MAS or development-provisioning concerns. The public DMG path is Developer ID signing plus notarization.

## Other Credential Options

The local Keychain profile above is the recommended flow for a human-operated release Mac. CI can use App Store Connect API keys instead:

```bash
export APPLE_API_KEY="/secure/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
npm run build:all:mac:signed
```

You can also pass Apple ID credentials directly, but this is less convenient than a stored Keychain profile:

```bash
export APPLE_ID="apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
npm run build:all:mac:signed
```

## Verify The Release

Run these checks before publishing the DMG.

### 1. Check Code Signature

Replace the app path if the architecture-specific output folder differs.

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac/Presenton.app"
codesign -dv --verbose=4 "dist/mac/Presenton.app" 2>&1 | grep -E "Authority|TeamIdentifier|Runtime"
```

Expected:

- `Authority=Developer ID Application: ...`
- `TeamIdentifier=S6W5C54KL6`
- Hardened Runtime is present.

### 2. Check Notarization Stapling

```bash
xcrun stapler validate "dist/mac/Presenton.app"
```

Expected:

```text
The validate action worked!
```

### 3. Check Gatekeeper

```bash
spctl --assess --type execute --verbose=4 "dist/mac/Presenton.app"
spctl --assess --type open --verbose=4 "dist/Presenton-0.8.8-beta.dmg"
```

Expected shape:

```text
accepted
source=Notarized Developer ID
```

### 4. Test On Another Mac

Download the DMG on a Mac that did not build it, mount it, drag Presenton to `/Applications`, and launch it normally. This catches quarantine and Gatekeeper behavior that local build machines can hide.

## Troubleshooting

**The signed release build says the Developer ID identity is missing**

Install a Developer ID Application certificate in Keychain Access, or set:

```bash
export PRESENTON_MAC_SIGN_IDENTITY="Developer ID Application: Your Company Name (TEAMID)"
```

**The build says notarization credentials are missing**

Set one complete credential group:

```bash
export APPLE_KEYCHAIN_PROFILE="presenton-notary"
```

or:

```bash
export APPLE_ID="apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

or:

```bash
export APPLE_API_KEY="/secure/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
```

**macOS still says the app is damaged or cannot be opened**

Run the verification commands above. If stapling fails, rebuild with valid notarization credentials and do not publish the DMG until `spctl` reports `source=Notarized Developer ID`.

**You need a local unsigned build**

Use the generic build script instead of the signed release script:

```bash
npm run build:all
```

For release artifacts, always use:

```bash
npm run build:all:mac:signed
```

## References

- Steve Crickmore's Electron MAS release gist: https://gist.github.com/steve981cr/def310670dfd9ed1439bf31cc734f941
- Electron signing and notarization docs: https://www.electronjs.org/docs/latest/tutorial/code-signing
- electron-builder notarization docs: https://www.electron.build/code-signing-mac.html#notarize
- Apple notarization docs: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
