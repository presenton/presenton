const builder = require("electron-builder")
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const packageMetadata = require("./package.json")
const {
  normalizeBundledMacChromiumForPackaging,
} = require("./scripts/prepare-export-chromium.cjs")

const APP_ID = "com.presenton.presenton"
const TEAM_ID = "S6W5C54KL6"
const macTarget = process.env.PRESENTON_MAC_TARGET
const isMasBuild = macTarget === "mas" || macTarget === "mas-dev"
const isDirectMacBuild = !isMasBuild && (process.platform === "darwin" || !!macTarget)
const requireDirectMacSigning = process.env.PRESENTON_REQUIRE_MAC_SIGNING === "1"
const masDevProvisioningProfile = resolveProvisioningProfileForTarget({
  target: "mas-dev",
  label: "MAS development",
  candidates: [
    "build/AppleDevelopment.provisionprofile",
    "build/AppleDev.provisionprofile",
    "build/AppDev.provisionprofile",
  ],
})
const masProvisioningProfile = resolveProvisioningProfileForTarget({
  target: "mas",
  label: "Mac App Store distribution",
  candidates: [
    "build/MacAppStore.provisionprofile",
    "build/AppDistri.provisionprofile",
  ],
})
const masDevIdentity =
  process.env.PRESENTON_MAS_DEV_IDENTITY || process.env.CSC_NAME || ""
const masSigningIdentities = resolveMasSigningIdentitiesForTarget()
const masIdentityQualifier = masSigningIdentities.qualifier
const masAppSigningIdentity = masSigningIdentities.appIdentity
const masInstallerSigningIdentity = masSigningIdentities.installerIdentity
const appStoreBundleShortVersion =
  macTarget === "mas" ? getAppStoreBundleShortVersion() : undefined
const appStoreBundleVersion =
  macTarget === "mas"
    ? getAppStoreBundleVersion(appStoreBundleShortVersion)
    : undefined
const macDistributionIdentity =
  process.env.PRESENTON_MAC_SIGN_IDENTITY ||
  process.env.CSC_NAME ||
  undefined
const shouldNotarizeDirectMacBuild =
  isDirectMacBuild && process.env.PRESENTON_SKIP_NOTARIZATION !== "1"
const shouldSignDirectMacDmg = isDirectMacBuild && requireDirectMacSigning
const masSigningExtraArgs =
  process.env.PRESENTON_CODESIGN_TIMESTAMP === "1" ? [] : ["--timestamp=none"]
const codesignTimestampRetries = Number.parseInt(
  process.env.PRESENTON_CODESIGN_TIMESTAMP_RETRIES || "4",
  10
)
const untimestampedNestedResourceExtensions = new Set([
  ".asar",
  ".avif",
  ".bcmap",
  ".bin",
  ".body",
  ".car",
  ".dat",
  ".emf",
  ".gif",
  ".gz",
  ".icns",
  ".ico",
  ".jpeg",
  ".jpg",
  ".json",
  ".nib",
  ".onnx",
  ".otf",
  ".pak",
  ".pb",
  ".pdf",
  ".pfb",
  ".png",
  ".pnm",
  ".pptx",
  ".pyc",
  ".strings",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
])
function getAppStoreBundleShortVersion() {
  const configuredVersion = process.env.PRESENTON_APP_STORE_VERSION
  if (configuredVersion) {
    validateAppStoreVersion(configuredVersion, "PRESENTON_APP_STORE_VERSION")
    return configuredVersion
  }

  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(packageMetadata.version)
  if (!match) {
    throw new Error(
      `Cannot derive an App Store version from package version "${packageMetadata.version}". Set PRESENTON_APP_STORE_VERSION to three period-separated integers, for example 1.0.0.`
    )
  }
  return `${match[1]}.${match[2]}.${match[3]}`
}

function getAppStoreBundleVersion(bundleShortVersion) {
  const configuredBuild = process.env.PRESENTON_APP_STORE_BUILD
  if (configuredBuild) {
    validateAppStoreBuild(configuredBuild, "PRESENTON_APP_STORE_BUILD")
    return configuredBuild
  }
  return bundleShortVersion
}

function validateAppStoreVersion(value, source) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(
      `${source} must be three period-separated integers, for example 1.0.0. Received: ${value}`
    )
  }
}

function validateAppStoreBuild(value, source) {
  if (!/^\d+(\.\d+){0,2}$/.test(value)) {
    throw new Error(
      `${source} must be one to three period-separated integers, for example 42 or 1.0.1. Received: ${value}`
    )
  }
}

function resolveProvisioningProfileForTarget({ target, label, candidates }) {
  try {
    return resolveProvisioningProfile({ target, label, candidates })
  } catch (error) {
    console.error(`\n${error.message}\n`)
    process.exit(1)
  }
}

function resolveProvisioningProfile({ target, label, candidates }) {
  if (macTarget !== target) {
    return undefined
  }

  if (process.platform !== "darwin") {
    throw new Error(
      `${label} builds must be run on macOS because Apple signing tools are required.`
    )
  }

  const undecodableProfiles = []

  for (const candidate of candidates) {
    const candidatePath = path.join(__dirname, candidate)
    if (!fs.existsSync(candidatePath)) {
      continue
    }

    if (canDecodeProvisioningProfile(candidatePath)) {
      return candidate
    }

    undecodableProfiles.push(candidate)
  }

  if (undecodableProfiles.length > 0) {
    throw new Error(
      `Found ${label} provisioning profile, but macOS could not decode it: ${undecodableProfiles.join(", ")}. Re-download the matching Apple provisioning profile and replace the local file.`
    )
  }

  throw new Error(
    `Missing ${label} provisioning profile. Expected: ${candidates.join(", ")}`
  )
}

function canDecodeProvisioningProfile(profilePath) {
  if (commandSucceeds("security", ["cms", "-D", "-i", profilePath])) {
    return true
  }

  if (
    commandSucceeds("openssl", [
      "cms",
      "-inform",
      "DER",
      "-verify",
      "-noverify",
      "-in",
      profilePath,
      "-out",
      "/dev/null",
    ])
  ) {
    return true
  }

  return false
}

function commandSucceeds(command, args) {
  try {
    execFileSync(command, args, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

async function signDirectMacApp(signOptions) {
  installCodesignTimestampRetry()
  const { signAsync } = require("@electron/osx-sign")
  const baseOptionsForFile = signOptions.optionsForFile

  return signAsync({
    ...signOptions,
    optionsForFile(filePath) {
      const options = baseOptionsForFile ? baseOptionsForFile(filePath) || {} : {}

      if (filePath === signOptions.app || !isUntimestampedNestedResource(filePath)) {
        return options
      }

      // osx-sign also signs binary resource blobs. Notarization requires secure
      // timestamps for Mach-O code, but not for data files like Chromium .pak files.
      return {
        ...options,
        timestamp: "none",
      }
    },
  })
}

function installCodesignTimestampRetry() {
  const osxSignUtil = require("@electron/osx-sign/dist/cjs/util.js")
  if (osxSignUtil.execFileAsync.__presentonTimestampRetryInstalled) {
    return
  }

  const execFileAsync = osxSignUtil.execFileAsync

  async function execFileAsyncWithTimestampRetry(file, args, options) {
    const maxRetries = Number.isFinite(codesignTimestampRetries)
      ? Math.max(0, codesignTimestampRetries)
      : 4

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await execFileAsync(file, args, options)
      } catch (error) {
        if (
          attempt >= maxRetries ||
          !isRetryableCodesignTimestampFailure(file, args, error)
        ) {
          throw error
        }

        const delayMs = Math.min(30000, 1000 * 2 ** attempt)
        console.warn(
          `codesign timestamp failed; retrying in ${delayMs}ms (${attempt + 1}/${maxRetries})`
        )
        await sleep(delayMs)
      }
    }
  }

  execFileAsyncWithTimestampRetry.__presentonTimestampRetryInstalled = true
  osxSignUtil.execFileAsync = execFileAsyncWithTimestampRetry
}

function isRetryableCodesignTimestampFailure(file, args, error) {
  if (file !== "codesign" || !codesignArgsRequireTimestamp(args)) {
    return false
  }

  const message = `${error && error.message ? error.message : error}`
  return (
    message.includes("A timestamp was expected but was not found") ||
    /timestamp/i.test(message)
  )
}

function codesignArgsRequireTimestamp(args) {
  if (!Array.isArray(args)) {
    return false
  }

  return args.some((arg) => arg === "--timestamp" || (
    arg.startsWith("--timestamp=") && arg !== "--timestamp=none"
  ))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isUntimestampedNestedResource(filePath) {
  return untimestampedNestedResourceExtensions.has(
    path.extname(filePath).toLowerCase()
  )
}

function resolveMasSigningIdentitiesForTarget() {
  if (macTarget !== "mas") {
    return {
      qualifier: "",
      appIdentity: "",
      installerIdentity: "",
    }
  }

  try {
    return resolveMasSigningIdentities()
  } catch (error) {
    console.error(`\n${error.message}\n`)
    process.exit(1)
  }
}

function resolveMasSigningIdentities() {
  const identities = getAppleSigningIdentities()
  const explicitIdentity =
    process.env.PRESENTON_MAS_DISTRIBUTION_IDENTITY ||
    process.env.PRESENTON_MAS_IDENTITY

  const qualifier = explicitIdentity
    ? validateMasIdentityQualifier(
      explicitIdentity,
      "PRESENTON_MAS_DISTRIBUTION_IDENTITY/PRESENTON_MAS_IDENTITY",
      identities
    )
    : process.env.CSC_NAME
    ? validateMasIdentityQualifier(
      String(process.env.CSC_NAME),
      "CSC_NAME",
      identities
    )
    : discoverMasIdentityQualifier(identities)

  const appIdentity = identities.find((identity) =>
    isMasAppIdentityName(identity.name) && identity.name.includes(qualifier)
  )
  const installerIdentity = identities.find((identity) =>
    isMasInstallerIdentityName(identity.name) && identity.name.includes(qualifier)
  )
  if (!appIdentity || !installerIdentity) {
    throw buildMissingMasIdentityError(qualifier, identities, {
      appIdentityFound: !!appIdentity,
      installerIdentityFound: !!installerIdentity,
    })
  }

  return {
    qualifier,
    appIdentity: appIdentity.name,
    installerIdentity: installerIdentity.name,
  }
}

function validateMasIdentityQualifier(value, source, identities) {
  const identity = value.trim()
  if (!identity) {
    throw new Error(`${source} is set but empty.`)
  }

  const matchedIdentity = identities.find(
    (candidate) => candidate.hash === identity || candidate.name === identity
  )
  const identityName = matchedIdentity?.name || identity
  if (isDevelopmentIdentityName(identityName)) {
    throw new Error(
      `${source} points to a development identity (${identityName}). MAS distribution builds require Apple Distribution or 3rd Party Mac Developer Application.`
    )
  }
  if (isMasAppIdentityName(identityName) || isMasInstallerIdentityName(identityName)) {
    return getMasIdentityQualifier(identityName)
  }
  if (/^[A-Fa-f0-9]{40}$/.test(identity) && !matchedIdentity) {
    throw new Error(
      `${source} is a certificate hash that was not found in the keychain, so the matching MAS installer certificate cannot be discovered. Use the certificate name or team qualifier instead.`
    )
  }

  return identity
}

function discoverMasIdentityQualifier(identities) {
  const appIdentity = identities.find((identity) => isMasAppIdentityName(identity.name))
  if (appIdentity) {
    return getMasIdentityQualifier(appIdentity.name)
  }

  throw buildMissingMasIdentityError("", identities, {
    appIdentityFound: false,
    installerIdentityFound: identities.some((identity) =>
      isMasInstallerIdentityName(identity.name)
    ),
  })
}

function getAppleSigningIdentities() {
  const outputs = []
  for (const args of [
    ["find-identity", "-v"],
    ["find-identity", "-v", "-p", "codesigning"],
  ]) {
    try {
      outputs.push(execFileSync("security", args, { encoding: "utf8" }))
    } catch {
      continue
    }
  }

  const seen = new Set()
  return outputs
    .join("\n")
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"([^"]+)"/)
      return match ? { hash: match[1], name: match[2] } : undefined
    })
    .filter(Boolean)
    .filter((identity) => {
      if (seen.has(identity.name)) {
        return false
      }
      seen.add(identity.name)
      return true
    })
}

function isMasAppIdentityName(name) {
  return /^(Apple Distribution|3rd Party Mac Developer Application):/.test(name)
}

function isMasInstallerIdentityName(name) {
  return /^3rd Party Mac Developer Installer:/.test(name)
}

function isDevelopmentIdentityName(name) {
  return /^(Apple Development|Mac Developer):/.test(name)
}

function isDeveloperIdApplicationIdentityName(name) {
  return /^Developer ID Application:/.test(name)
}

function getMasIdentityQualifier(identityName) {
  return identityName.replace(
    /^(Apple Distribution|3rd Party Mac Developer Application|3rd Party Mac Developer Installer):\s*/,
    ""
  )
}

function buildMissingMasIdentityError(qualifier, identities, status) {
  const availableIdentities = identities.length
    ? identities.map((identity) => `  - ${identity.name}`).join("\n")
    : "  (no valid Apple signing identities found)"
  const expectedQualifier = qualifier ? ` matching "${qualifier}"` : ""
  return new Error(
    [
      "Missing MAS signing identity.",
      `MAS distribution builds require both an app certificate and an installer certificate${expectedQualifier}:`,
      "  - Apple Distribution or 3rd Party Mac Developer Application",
      "  - 3rd Party Mac Developer Installer",
      "",
      `App certificate found: ${status.appIdentityFound ? "yes" : "no"}`,
      `Installer certificate found: ${status.installerIdentityFound ? "yes" : "no"}`,
      "",
      "Create/download the missing certificate from Apple Developer Certificates,",
      "install it in Keychain Access, then rerun the build.",
      "",
      "Available Apple signing identities:",
      availableIdentities,
    ].join("\n")
  )
}

function assertCodesignCanUseIdentity(identity) {
  if (!identity || macTarget !== "mas" || process.platform !== "darwin") {
    return
  }

  const tempDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "presenton-codesign-"))
  const tempFile = path.join(tempDir, "preflight")
  try {
    fs.writeFileSync(tempFile, "Presenton MAS signing preflight\n")
    execFileSync(
      "codesign",
      ["--force", "--sign", identity, "--timestamp=none", tempFile],
      { stdio: "ignore", timeout: 30000 }
    )
  } catch (error) {
    const timedOut = error && error.signal === "SIGTERM"
    throw new Error(
      [
        "Could not complete MAS signing preflight with the selected distribution identity.",
        timedOut
          ? "codesign timed out, usually because macOS is waiting for Keychain/private-key access."
          : "codesign failed before electron-builder started signing the app.",
        "Unlock the login keychain and allow codesign access to the Apple Distribution private key, then rerun the build.",
        `Identity: ${identity}`,
      ].join("\n")
    )
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function assertDirectMacReleaseReadiness() {
  if (!isDirectMacBuild || !requireDirectMacSigning) {
    return
  }

  if (process.platform !== "darwin") {
    throw new Error(
      "Signed macOS distribution builds must be run on macOS because Apple codesign and notarytool are required."
    )
  }

  const identity = resolveDeveloperIdApplicationIdentity()
  assertDirectMacNotarizationCredentials()
  assertCodesignCanUseDirectIdentity(identity)
}

function resolveDeveloperIdApplicationIdentity() {
  const identities = getAppleSigningIdentities()
  const configuredIdentity = macDistributionIdentity

  if (configuredIdentity) {
    const matchedIdentity = identities.find(
      (candidate) =>
        candidate.hash === configuredIdentity || candidate.name === configuredIdentity
    )
    const identityName = matchedIdentity?.name || configuredIdentity

    if (!matchedIdentity) {
      throw new Error(
        [
          "The configured macOS signing identity was not found in the keychain.",
          "Direct distribution requires a Developer ID Application certificate.",
          `Configured identity: ${configuredIdentity}`,
          "",
          buildAvailableDeveloperIdIdentityList(identities),
        ].join("\n")
      )
    }

    if (!isDeveloperIdApplicationIdentityName(identityName)) {
      throw new Error(
        [
          "The configured macOS signing identity is not valid for direct distribution.",
          "Use a Developer ID Application certificate, not Apple Development, Apple Distribution, or a Mac App Store certificate.",
          `Configured identity: ${identityName}`,
        ].join("\n")
      )
    }

    return identityName
  }

  const discoveredIdentity = identities.find((identity) =>
    isDeveloperIdApplicationIdentityName(identity.name)
  )
  if (!discoveredIdentity) {
    throw new Error(
      [
        "Missing Developer ID Application signing identity.",
        "Install the certificate in Keychain Access or set PRESENTON_MAC_SIGN_IDENTITY to its exact name.",
        "",
        buildAvailableDeveloperIdIdentityList(identities),
      ].join("\n")
    )
  }

  return discoveredIdentity.name
}

function buildAvailableDeveloperIdIdentityList(identities) {
  const available = identities.length
    ? identities.map((identity) => `  - ${identity.name}`).join("\n")
    : "  (no valid Apple signing identities found)"

  return ["Available Apple signing identities:", available].join("\n")
}

function assertDirectMacNotarizationCredentials() {
  if (!shouldNotarizeDirectMacBuild) {
    throw new Error(
      "PRESENTON_SKIP_NOTARIZATION=1 is not allowed when PRESENTON_REQUIRE_MAC_SIGNING=1."
    )
  }

  const hasAppleIdCredentials =
    !!process.env.APPLE_ID &&
    !!process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    !!process.env.APPLE_TEAM_ID
  const hasApiKeyCredentials =
    !!process.env.APPLE_API_KEY &&
    !!process.env.APPLE_API_KEY_ID &&
    !!process.env.APPLE_API_ISSUER
  const hasKeychainProfile = !!process.env.APPLE_KEYCHAIN_PROFILE

  if (hasAppleIdCredentials || hasApiKeyCredentials || hasKeychainProfile) {
    return
  }

  throw new Error(
    [
      "Missing Apple notarization credentials.",
      "Set one of these credential groups before running the signed macOS release build:",
      "  - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID",
      "  - APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER",
      "  - APPLE_KEYCHAIN_PROFILE, optionally APPLE_KEYCHAIN",
    ].join("\n")
  )
}

function assertCodesignCanUseDirectIdentity(identity) {
  const tempDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "presenton-codesign-"))
  const tempFile = path.join(tempDir, "preflight")
  try {
    fs.writeFileSync(tempFile, "Presenton direct macOS signing preflight\n")
    execFileSync(
      "codesign",
      ["--force", "--sign", identity, "--options", "runtime", tempFile],
      { stdio: "ignore", timeout: 30000 }
    )
  } catch (error) {
    const timedOut = error && error.signal === "SIGTERM"
    throw new Error(
      [
        "Could not complete direct macOS signing preflight with the selected Developer ID identity.",
        timedOut
          ? "codesign timed out, usually because macOS is waiting for Keychain/private-key access."
          : "codesign failed before electron-builder started signing the app.",
        "Unlock the login keychain and allow codesign access to the Developer ID private key, then rerun the build.",
        `Identity: ${identity}`,
      ].join("\n")
    )
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function getFastApiBinaryName(platform = process.platform) {
  return platform === "win32" ? "fastapi.exe" : "fastapi"
}

function findNextJsStandaloneServer(nextjsRoot) {
  const directScript = path.join(nextjsRoot, "server.js")
  if (fs.existsSync(directScript)) {
    return directScript
  }

  const nestedScript = path.join(nextjsRoot, "servers", "nextjs", "server.js")
  if (fs.existsSync(nestedScript)) {
    return nestedScript
  }

  return null
}

function formatMissingBundleResources(missing) {
  return missing.map((item) => `  - ${item.label}: ${item.path}`).join("\n")
}

function collectMissingBundleResources(resourcesRoot) {
  const fastapiPath = path.join(resourcesRoot, "fastapi", getFastApiBinaryName())
  const nextjsRoot = path.join(resourcesRoot, "nextjs")
  const missing = []

  if (!fs.existsSync(fastapiPath)) {
    missing.push({ label: "FastAPI binary", path: fastapiPath })
  }
  if (!findNextJsStandaloneServer(nextjsRoot)) {
    const directNextServer = path.join(nextjsRoot, "server.js")
    const nestedNextServer = path.join(nextjsRoot, "servers", "nextjs", "server.js")
    missing.push({
      label: "Next.js standalone server",
      path: `${directNextServer} or ${nestedNextServer}`,
    })
  }

  return missing
}

function assertSourceBundleResourcesReady() {
  const resourcesRoot = path.join(__dirname, "resources")
  const missing = collectMissingBundleResources(resourcesRoot)
  if (missing.length === 0) {
    return
  }

  throw new Error(
    [
      "Required Electron bundle resources are missing before packaging.",
      "Run `npm run build:all:mac:signed` for a full signed DMG build, or run `npm run build:nextjs && npm run build:fastapi` before package-only scripts.",
      "Missing:",
      formatMissingBundleResources(missing),
    ].join("\n")
  )
}

function assertPackagedBundleResourcesReady(resourcesRoot) {
  const missing = collectMissingBundleResources(resourcesRoot)
  if (missing.length === 0) {
    return
  }

  throw new Error(
    [
      "Packaged app is missing required runtime resources.",
      "This would produce a signed app that cannot start its bundled servers.",
      "Missing:",
      formatMissingBundleResources(missing),
    ].join("\n")
  )
}

// AfterPack hook: set executable permissions and repair packaged runtime bundles on macOS.
const afterPack = async (context) => {
  if (context.electronPlatformName === "darwin") {
    const appPath = context.appOutDir
    const appBundleName = `${context.packager.appInfo.productFilename}.app`
    const resourcesRoot = resolvePackagedResourcesRoot(
      appPath,
      appBundleName
    )
    assertPackagedBundleResourcesReady(resourcesRoot)

    const fastapiPath = path.join(resourcesRoot, "fastapi", getFastApiBinaryName("darwin"))
    const exportPyDir = path.join(resourcesRoot, "export", "py")
    const converterCandidates = [
      `convert-${process.platform}-${process.arch}`,
      `convert-${process.platform}`,
      "convert",
    ]

    console.log("Setting executable permissions for FastAPI binary...")
    console.log("FastAPI path:", fastapiPath)

    if (fs.existsSync(fastapiPath)) {
      fs.chmodSync(fastapiPath, 0o755)
      console.log("✓ Execute permissions set for FastAPI")
    } else {
      console.warn("⚠ FastAPI binary not found at:", fastapiPath)
    }

    console.log("Setting executable permissions for export converter binary...")
    let converterFound = false
    for (const candidate of converterCandidates) {
      const candidatePath = path.join(exportPyDir, candidate)
      if (fs.existsSync(candidatePath)) {
        fs.chmodSync(candidatePath, 0o755)
        console.log("✓ Execute permissions set for converter:", candidatePath)
        converterFound = true
      }
    }
    if (!converterFound) {
      console.warn("⚠ No converter binary found in:", exportPyDir)
    }

    const fastapiDir = path.join(resourcesRoot, "fastapi")
    if (fs.existsSync(fastapiDir)) {
      console.log("FastAPI directory contents:", fs.readdirSync(fastapiDir))
    }

    if (fs.existsSync(exportPyDir)) {
      console.log("Export py directory contents:", fs.readdirSync(exportPyDir))
    }

    pruneUnsupportedPackagedPrebuilds(
      resolvePackagedAppRoot(appPath, appBundleName),
      context.arch
    )
    normalizeBundledMacChromiumForPackaging(resourcesRoot)
  }
}

function resolvePackagedAppRoot(appPath, appBundleName) {
  const contentsResourcesRoot = path.join(appPath, appBundleName, "Contents", "Resources")
  const candidates = [
    path.join(contentsResourcesRoot, "app.asar.unpacked"),
    path.join(contentsResourcesRoot, "app"),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
}

function resolvePackagedResourcesRoot(appPath, appBundleName) {
  return path.join(resolvePackagedAppRoot(appPath, appBundleName), "resources")
}

function pruneUnsupportedPackagedPrebuilds(appRoot, arch) {
  const nodeModulesRoot = path.join(appRoot, "node_modules")
  if (!fs.existsSync(nodeModulesRoot)) {
    return
  }

  const supportedPrebuilds = getSupportedDarwinPrebuilds(arch)
  let removed = 0

  for (const prebuildsRoot of findDirectoriesNamed(nodeModulesRoot, "prebuilds")) {
    for (const entry of fs.readdirSync(prebuildsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || supportedPrebuilds.has(entry.name)) {
        continue
      }

      const candidatePath = path.join(prebuildsRoot, entry.name)
      if (!/^[a-z0-9]+-[a-z0-9-]+$/i.test(entry.name)) {
        continue
      }

      fs.rmSync(candidatePath, { recursive: true, force: true })
      removed += 1
    }
  }

  if (removed > 0) {
    console.log(
      `Pruned ${removed} unsupported native prebuild director${removed === 1 ? "y" : "ies"} from packaged macOS app.`
    )
  }
}

function getSupportedDarwinPrebuilds(arch) {
  const archName = builder.Arch[arch] || process.arch
  if (archName === "universal") {
    return new Set(["darwin-arm64", "darwin-x64"])
  }
  return new Set([`darwin-${archName}`])
}

function findDirectoriesNamed(root, name) {
  const matches = []
  const stack = [root]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const fullPath = path.join(current, entry.name)
      if (entry.name === name) {
        matches.push(fullPath)
        continue
      }
      stack.push(fullPath)
    }
  }

  return matches
}

const config = {
  appId: APP_ID,
  productName: "Presenton",
  asar: true,
  asarUnpack: [
    "resources/**",
    // LiteParse runs from FastAPI via Electron-as-Node and needs real package dirs.
    "node_modules/**",
  ],
  copyright: "Copyright © 2026 Presenton",
  directories: {
    output: "dist",
    buildResources: "build",
  },
  files: [
    "resources",
    "app_dist",
    "NOTICE"
  ],
  extraResources: [
    {
      from: path.join(__dirname, "..", "scripts", "user-config-env.cjs"),
      to: "user-config-env.cjs",
    },
  ],
  afterPack,
  mac: {
    artifactName: "Presenton-${version}.${ext}",
    target: [macTarget || "dmg"],
    category: "public.app-category.productivity",
    hardenedRuntime: !isMasBuild,
    gatekeeperAssess: false,
    entitlements: isMasBuild ? undefined : "build/entitlements.mac.plist",
    entitlementsInherit: isMasBuild ? undefined : "build/entitlements.mac.inherit.plist",
    identity:
      macTarget === "mas" || macTarget === "mas-dev"
        ? null
        : macDistributionIdentity,
    notarize: isMasBuild || !shouldNotarizeDirectMacBuild ? false : true,
    sign: isMasBuild ? undefined : signDirectMacApp,
    icon: "build/icon.icns",
    bundleShortVersion: appStoreBundleShortVersion,
    bundleVersion: appStoreBundleVersion,
    extendInfo: {
      ElectronTeamID: TEAM_ID,
    },
  },
  masDev: {
    type: "development",
    identity: masDevIdentity || undefined,
    provisioningProfile: masDevProvisioningProfile,
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    // osx-sign always adds --timestamp; this later flag keeps local MAS dev signing offline-tolerant.
    additionalArguments: ["--timestamp=none"],
  },
  mas: {
    type: "distribution",
    identity: masIdentityQualifier || undefined,
    provisioningProfile: masProvisioningProfile,
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    // Avoid codesign hanging on Apple's timestamp service during local MAS packaging.
    additionalArguments: masSigningExtraArgs,
  },
  linux: {
    artifactName: "Presenton-${version}.${ext}",
    target: ["AppImage", "deb"],
    icon: "build/icons",
    category: "Office",
  },
  deb: {
    afterInstall: "build/after-install.tpl",
  },
  win: {
    target: ["nsis", "appx"],
    icon: "build/icon.ico",
    artifactName: "Presenton-${version}.${ext}",
    executableName: "Presenton",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: "build/icon.ico",
    uninstallerIcon: "build/icon.ico",
    installerHeaderIcon: "build/icon.ico",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Presenton",
    uninstallDisplayName: "Presenton",
  },
  dmg: {
    sign: shouldSignDirectMacDmg,
    size: "2300m",
  },
  appx: {
    identityName: "PresentonAI.Presenton",
    publisher: "CN=8A2C57B5-F1C6-473A-93EE-2E9B72134341",
    displayName: "Presenton",
    publisherDisplayName: "Presenton Inc.",
    applicationId: "PresentonAI.Presenton",
    
  },
}

const effectiveMacTarget = macTarget || "dmg"
const targets =
  process.platform === "darwin"
    ? builder.Platform.MAC.createTarget([effectiveMacTarget])
    : undefined

assertSourceBundleResourcesReady()

if (macTarget === "mas" && process.env.PRESENTON_SKIP_CODESIGN_PREFLIGHT !== "1") {
  assertCodesignCanUseIdentity(masAppSigningIdentity)
}

assertDirectMacReleaseReadiness()

if (isDirectMacBuild && process.platform === "darwin") {
  console.log("[macOS direct] Distribution settings:", {
    target: effectiveMacTarget,
    identity: macDistributionIdentity || "auto",
    hardenedRuntime: true,
    notarize: shouldNotarizeDirectMacBuild,
    dmgSign: shouldSignDirectMacDmg,
    signingRequired: requireDirectMacSigning,
  })
}

if (macTarget === "mas") {
  console.log("[MAS] Signing preflight:", {
    identityQualifier: masIdentityQualifier || "auto",
    appIdentity: masAppSigningIdentity || "none",
    installerIdentity: masInstallerSigningIdentity || "none",
    provisioningProfile: masProvisioningProfile || "none",
    additionalArguments: masSigningExtraArgs,
  })
}

builder.build({ targets, config })
