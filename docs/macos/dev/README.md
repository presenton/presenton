# macOS Development & Distribution

Guides for building and signing the Presenton Electron app on macOS.

| Guide | Description |
|-------|-------------|
| [Mac App Store setup](./mac-app-store-setup.md) | Certificates, provisioning profiles, MAS build commands, and submission notes |

## Quick reference

All commands below run from the `electron/` directory on a Mac.

**First-time setup**

```bash
cd electron
npm run setup:env
```

**Run locally (development)**

```bash
npm run dev
```

**Build a DMG (local distribution, not App Store)**

```bash
npm run build:all
```

Output is written to `electron/dist/`. The default macOS target is a DMG built via `electron/build.js`.

**Build for the Mac App Store**

See [Mac App Store setup](./mac-app-store-setup.md) for certificates, provisioning profiles, and signing. Summary:

```bash
npm run build:all:mas-dev   # development / TestFlight-style testing
npm run build:all:mas       # distribution / App Store submission
```

## Related docs

- [Electron dependency strategy](../../electron-dependency-strategy.md) — bundled Chromium, ImageMagick, and export runtime
- [Project README — Electron section](../../../README.md) — prerequisites and high-level build steps
