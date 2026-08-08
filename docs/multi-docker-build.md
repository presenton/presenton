# Multi-Arch Docker Release

This document describes how to publish `presenton` as a multi-architecture image to GitHub Container Registry (`ghcr.io`).

The flow is:

1. Build the image separately on each native platform.
2. Push an architecture-specific tag from each machine.
3. Create a multi-arch manifest that points to both images.
4. Promote that manifest to `latest`.

## Expected Local Image

After a successful local production build, the image should exist as:

```text
presenton-3-production:latest
```

## Release Tags

This example uses version `v0.9.0-beta`:

```text
ghcr.io/presenton/presenton:v0.9.0-beta-arm64
ghcr.io/presenton/presenton:v0.9.0-beta-amd64
ghcr.io/presenton/presenton:v0.9.0-beta
ghcr.io/presenton/presenton:latest
```

## 1. Push the ARM64 Image From macOS

Run this on the Mac machine that built the ARM64 image:

```bash
docker tag presenton-3-production:latest \
  ghcr.io/presenton/presenton:v0.9.0-beta-arm64

docker push ghcr.io/presenton/presenton:v0.9.0-beta-arm64
```

## 2. Push the AMD64 Image From Linux

Run this on the Linux machine that built the AMD64 image:

```bash
docker tag presenton-3-production:latest \
  ghcr.io/presenton/presenton:v0.9.0-beta-amd64

docker push ghcr.io/presenton/presenton:v0.9.0-beta-amd64
```

## 3. Create the Multi-Arch Manifest

After both architecture-specific images are pushed, run this on either machine:

```bash
docker buildx imagetools create \
  -t ghcr.io/presenton/presenton:v0.9.0-beta \
  ghcr.io/presenton/presenton:v0.9.0-beta-amd64 \
  ghcr.io/presenton/presenton:v0.9.0-beta-arm64
```

## 4. Promote the Release to `latest`

```bash
docker buildx imagetools create \
  -t ghcr.io/presenton/presenton:latest \
  ghcr.io/presenton/presenton:v0.9.0-beta
```

## 5. Verify the Published Manifests

```bash
docker buildx imagetools inspect ghcr.io/presenton/presenton:v0.9.0-beta

docker buildx imagetools inspect ghcr.io/presenton/presenton:latest
```

Both manifests should include:

```text
linux/amd64
linux/arm64
```

## Result

After the release completes, these tags should exist:

- `v0.9.0-beta-arm64`: native ARM64 image
- `v0.9.0-beta-amd64`: native AMD64 image
- `v0.9.0-beta`: multi-arch manifest
- `latest`: multi-arch manifest pointing at the same release
