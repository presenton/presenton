# Signed macOS DMG Build Steps

This document records the exact flow used to build a signed, notarized, and stapled macOS DMG for direct distribution outside the Mac App Store.

The flow starts from the `electron/` directory and produces:

```text
electron/dist/Presenton-<version>.dmg
electron/dist/Presenton-<version>.dmg.blockmap
electron/dist/latest-mac.yml
```

## 1. Start From The Electron Directory

Run all commands from the Electron project directory:

```bash
cd electron
```

This keeps Electron Builder paths, build resources, and output paths aligned with `electron/build.js`.

## 2. Confirm The Developer ID Certificate

Check that the release Mac has a Developer ID Application certificate installed:

```bash
security find-identity -v -p codesigning
```

This confirms that `codesign` can see the certificate used for public, non-Mac-App-Store distribution.

Expected identity shape:

```text
Developer ID Application: Presenton Inc. (S6W5C54KL6)
```

If more than one Developer ID Application certificate is installed, pin the intended one:

```bash
export PRESENTON_MAC_SIGN_IDENTITY="Developer ID Application: Presenton Inc. (S6W5C54KL6)"
```

## 3. Confirm The Notarytool Profile

Check that the local Keychain has the stored Apple notarization profile:

```bash
xcrun notarytool history --keychain-profile presenton-notary
```

This verifies that Apple notarization credentials are available without exposing the Apple ID password or app-specific password in the shell.

For this build, the profile name was:

```bash
presenton-notary
```

## 4. Choose The Build Script

Use the full build when app resources need to be rebuilt:

```bash
APPLE_KEYCHAIN_PROFILE=presenton-notary npm run build:all:mac:signed
```

This performs setup cleanup, dependency setup, TypeScript build, Next.js resource build, FastAPI binary build, Electron packaging, signing, and notarization.

Use the packaging-only build when `resources/` and `app_dist/` are already current:

```bash
APPLE_KEYCHAIN_PROFILE=presenton-notary npm run dist:mac:signed
```

This runs Electron Builder directly through `electron/build.js` and reuses the existing built resources.

## 5. Run The Signed Electron Build

The command used for the final packaging pass was:

```bash
APPLE_KEYCHAIN_PROFILE=presenton-notary npm run dist:mac:signed
```

The script expands to:

```bash
cross-env PRESENTON_MAC_TARGET=dmg PRESENTON_REQUIRE_MAC_SIGNING=1 node build.js
```

This performs the required release preflight:

- Confirms the build is running on macOS.
- Confirms a Developer ID Application signing identity is available.
- Confirms notarization credentials are available.
- Prevents `PRESENTON_SKIP_NOTARIZATION=1` when signing is required.

## 6. Let Electron Builder Package The App

Electron Builder packages the app into:

```text
electron/dist/mac-arm64/Presenton.app
```

During `afterPack`, `build.js` also:

- Sets executable permissions on the bundled FastAPI binary.
- Sets executable permissions on the export converter binary.
- Prunes unsupported native prebuild directories from the packaged macOS app.
- Normalizes the bundled macOS Chromium runtime for packaging.

Do not interrupt this phase. The app has a large unpacked resource tree and can be quiet for several minutes.

## 7. Let The App Bundle Signing Complete

Electron Builder calls the custom `signDirectMacApp` function from `build.js`.

That function signs the app bundle with:

```text
Developer ID Application: Presenton Inc. (S6W5C54KL6)
```

It also installs retry handling around Apple timestamp failures. A retry message like this can appear:

```text
codesign timestamp failed; retrying in 1000ms (1/4)
```

This does not mean the build has failed. Let the retry finish unless Electron Builder exits with a real error.

## 8. Let Electron Builder Notarize And Staple The App

After the app bundle is signed, Electron Builder submits the app for Apple notarization using the `APPLE_KEYCHAIN_PROFILE` value.

When Apple accepts the submission, Electron Builder staples the ticket to:

```text
electron/dist/mac-arm64/Presenton.app
```

Expected build output includes:

```text
notarization successful
```

## 9. Let Electron Builder Create The DMG

After app notarization succeeds, Electron Builder creates:

```text
electron/dist/Presenton-<version>.dmg
electron/dist/Presenton-<version>.dmg.blockmap
electron/dist/latest-mac.yml
```

In the current repository configuration, `dmg.sign` is `false`, so this step creates a DMG that contains a signed and notarized app, but the DMG container itself is not yet signed or stapled.

For a signed DMG container, continue with the post-build steps below.

## 10. Sign The DMG Container

Sign the generated DMG with the Developer ID Application certificate:

```bash
codesign --force \
  --sign "Developer ID Application: Presenton Inc. (S6W5C54KL6)" \
  --timestamp \
  dist/Presenton-0.9.0-beta.dmg
```

This adds a Developer ID code signature and timestamp to the disk image itself.

## 11. Notarize The Signed DMG

Submit the signed DMG to Apple:

```bash
xcrun notarytool submit dist/Presenton-0.9.0-beta.dmg \
  --keychain-profile presenton-notary \
  --wait
```

This uploads the DMG to Apple, waits for processing, and exits only after the submission is accepted or rejected.

Expected final status:

```text
status: Accepted
```

## 12. Staple The DMG Ticket

Staple the accepted notarization ticket to the DMG:

```bash
xcrun stapler staple dist/Presenton-0.9.0-beta.dmg
```

This embeds the notarization ticket in the DMG so Gatekeeper can validate it without needing to query Apple at first launch.

Expected output:

```text
The staple and validate action worked!
```

## 13. Regenerate The Blockmap

Signing and stapling modify the DMG bytes, so the blockmap generated by Electron Builder is no longer valid.

Regenerate it from the final DMG:

```bash
node_modules/app-builder-bin/mac/app-builder_arm64 blockmap \
  --input dist/Presenton-0.9.0-beta.dmg \
  --output dist/Presenton-0.9.0-beta.dmg.blockmap
```

The command prints the final DMG `size` and base64 `sha512`. Keep those values for the next step.

## 14. Update latest-mac.yml

Update `dist/latest-mac.yml` so it references the final signed and stapled DMG bytes.

Set both top-level and file-level values:

```yaml
files:
  - url: Presenton-0.9.0-beta.dmg
    sha512: <final-dmg-sha512>
    size: <final-dmg-size>
path: Presenton-0.9.0-beta.dmg
sha512: <final-dmg-sha512>
releaseDate: '<current-utc-release-date>'
```

This keeps update metadata consistent with the final artifact.

## 15. Verify The App Bundle

Verify the app bundle signature:

```bash
codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Presenton.app
```

Inspect the signing metadata:

```bash
codesign -dv --verbose=4 dist/mac-arm64/Presenton.app
```

Expected metadata includes:

```text
Authority=Developer ID Application: Presenton Inc. (S6W5C54KL6)
TeamIdentifier=S6W5C54KL6
Runtime
Timestamp
Notarization Ticket=stapled
```

Validate the stapled app ticket:

```bash
xcrun stapler validate dist/mac-arm64/Presenton.app
```

Assess the app with Gatekeeper:

```bash
spctl --assess --type execute --verbose=4 dist/mac-arm64/Presenton.app
```

Expected result:

```text
accepted
source=Notarized Developer ID
```

## 16. Verify The DMG

Verify the DMG code signature:

```bash
codesign --verify --verbose=2 dist/Presenton-0.9.0-beta.dmg
```

Inspect the DMG signing metadata:

```bash
codesign -dv --verbose=4 dist/Presenton-0.9.0-beta.dmg
```

Expected metadata includes:

```text
Format=disk image
Authority=Developer ID Application: Presenton Inc. (S6W5C54KL6)
TeamIdentifier=S6W5C54KL6
Timestamp
Notarization Ticket=stapled
```

Validate the stapled DMG ticket:

```bash
xcrun stapler validate dist/Presenton-0.9.0-beta.dmg
```

Assess the DMG with Gatekeeper using disk-image context:

```bash
spctl --assess \
  --type open \
  --context context:primary-signature \
  --verbose=4 \
  dist/Presenton-0.9.0-beta.dmg
```

You can also assess it as an install artifact:

```bash
spctl --assess --type install --verbose=4 dist/Presenton-0.9.0-beta.dmg
```

Expected result:

```text
accepted
source=Notarized Developer ID
```

Verify the DMG image checksum structure:

```bash
hdiutil verify dist/Presenton-0.9.0-beta.dmg
```

Expected result:

```text
hdiutil: verify: checksum of "dist/Presenton-0.9.0-beta.dmg" is VALID
```

## 17. Record The Final SHA-256

Generate a release checksum:

```bash
shasum -a 256 dist/Presenton-0.9.0-beta.dmg
```

For the signed and stapled `0.9.0-beta` DMG built in this flow, the SHA-256 was:

```text
5bcfcb6d21059b05578e854fccfbff33825f54bfca09c379ed2bc624259e3e23
```

## Final Artifact Checklist

Before publishing, confirm:

- `dist/Presenton-<version>.dmg` exists.
- `dist/Presenton-<version>.dmg.blockmap` was regenerated after DMG stapling.
- `dist/latest-mac.yml` matches the final DMG `sha512` and `size`.
- `codesign --verify` passes for both app and DMG.
- `xcrun stapler validate` passes for both app and DMG.
- `spctl` reports `accepted` and `source=Notarized Developer ID`.
- `hdiutil verify` reports the DMG checksum is valid.
