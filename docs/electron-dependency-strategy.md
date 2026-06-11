# Electron Dependency Strategy

This is the working strategy for reducing first-run dependency installers in
the Electron app while keeping Presenton Apache-2.0.

## Recommendation

- Bundle Chrome for Testing with the Electron package (including Microsoft APPX)
  for export rendering.
- Bundle ImageMagick under `resources/imagemagick/` for each platform build; the
  packaged app validates that bundle during `afterPack`.
- Bundle the presentation export runtime for PPTX-to-HTML conversion and use
  Chromium to render custom template previews.
- Extract modern OOXML/OpenDocument text directly without an office engine.

## Licensing Notes

This is engineering guidance, not legal advice.

ImageMagick is practical to bundle. The official license permits personal,
internal, and commercial use, and its terms are close to Apache-2.0. Keep the
ImageMagick license and notices in the distributed app.
Source: https://imagemagick.org/license/

Chromium/Chrome for Testing can be bundled, but the notices matter. Puppeteer
now targets Chrome for Testing for supported automation, and Chromium source is
BSD-style plus third-party licenses. Keep generated browser credits/notices with
the shipped runtime.
Sources:
- https://pptr.dev/supported-browsers
- https://chromium.googlesource.com/chromium/src/+/main/LICENSE
- https://www.chromium.org/chromium-os/licensing/

## Runtime Layout

Bundled Chromium:

```text
electron/resources/chromium/
  presenton-runtime.json
  chrome/<platform-build-id>/...
```

Populate it with:

```bash
cd electron
npm run prepare:export-chromium
```

Set `SKIP_BUNDLED_CHROMIUM=1` to keep the old first-run download behavior.

Bundled ImageMagick:

```text
electron/resources/imagemagick/<platform>-<arch>/
  presenton-runtime.json
  ...
```

Examples:

```text
electron/resources/imagemagick/win32-x64/magick.exe
electron/resources/imagemagick/darwin-arm64/bin/magick
electron/resources/imagemagick/linux-x64/bin/magick
```

Populate it with:

```bash
cd electron
npm run prepare:imagemagick
```

Platform behavior:

- Windows downloads and validates the official portable `.7z` runtime.
- Linux downloads and validates the official AppImage, then writes a `bin/magick`
  wrapper with `APPIMAGE_EXTRACT_AND_RUN=1` so it works without a host FUSE setup.
- macOS vendors a build-host ImageMagick prefix (`magick` on PATH, or
  `IMAGEMAGICK_VENDOR_DIR`) and rewrites non-system dylib references into the
  packaged runtime with `otool` and `install_name_tool`.

The app checks the manifest-backed bundle before PATH, Homebrew, MacPorts, or
other system installs.

## Current Behavior

- FastAPI receives `IMAGEMAGICK_BINARY`, `MAGICK_HOME`, and
  `MAGICK_CONFIGURE_PATH` when the bundled or system ImageMagick runtime is
  detected at startup.
- PPTX previews use the bundled PPTX-to-HTML converter and Chromium renderer.
- Modern OOXML/OpenDocument text extraction uses the bundled Python parser.
- Export Chromium and ImageMagick resolution check manifest-backed bundled app
  runtimes before user or system locations.

## APPX / Store builds

Before `npm run build:electron`:

1. Run `npm run prepare:export-chromium` so Chromium is under `resources/chromium/`.
2. Run `npm run prepare:imagemagick` so ImageMagick is under
   `resources/imagemagick/<platform>-<arch>/`.
3. The bundled export runtime and Chromium handle Template Studio previews.

Microsoft Store (MSIX/APPX) packages install under `Program Files\WindowsApps`.
Bundled Chrome cannot be launched in place from that folder; on first export the app
copies the browser tree to `%LOCALAPPDATA%\…\Cache\msix-export-chromium\` (same pattern
as the MSIX export runtime for Sharp). The portable EXE install does not need this copy.
