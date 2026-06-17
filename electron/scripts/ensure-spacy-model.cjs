const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const electronRoot = path.join(__dirname, "..");
const fastapiDir = path.join(electronRoot, "..", "servers", "fastapi");
const uvCmd = process.platform === "win32" ? "uv.exe" : "uv";
const requiredModel = process.env.MEM0_SPACY_MODEL || "en_core_web_sm";
const strictMode =
  (process.env.MEM0_SPACY_STRICT || "").trim().toLowerCase() === "true";
const venvDir = path.join(fastapiDir, ".venv");

function runUv(args, description) {
  const result = spawnSync(uvCmd, args, {
    cwd: fastapiDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw new Error(`${description} failed: ${result.error.message}`);
  }
  return result.status === 0;
}

function runUvPython(args, description) {
  return runUv(["run", "python", ...args], description);
}

function ensureVenv() {
  if (fs.existsSync(venvDir)) {
    return true;
  }
  console.log(`[spacy-setup] Creating uv venv at ${venvDir}`);
  return runUv(["venv"], "uv venv");
}

function hasModelInstalled() {
  return runUvPython(
    ["-c", `import spacy; spacy.load("${requiredModel}")`],
    `spaCy model check (${requiredModel})`,
  );
}

function installModel() {
  return runUvPython(
    ["-m", "spacy", "download", requiredModel],
    `spaCy model install (${requiredModel})`,
  );
}

function main() {
  if (!ensureVenv()) {
    throw new Error("Failed to create uv virtual environment");
  }
  console.log(`[spacy-setup] Checking spaCy model: ${requiredModel}`);
  if (hasModelInstalled()) {
    console.log(
      `[spacy-setup] spaCy model already available: ${requiredModel}`,
    );
    return;
  }

  console.log(`[spacy-setup] Installing spaCy model: ${requiredModel}`);
  const installed = installModel();
  if (installed && hasModelInstalled()) {
    console.log(`[spacy-setup] spaCy model installed: ${requiredModel}`);
    return;
  }

  const message =
    `[spacy-setup] Could not install spaCy model (${requiredModel}). ` +
    "Mem0 will self-disable at runtime if this dependency is unavailable.";

  if (strictMode) {
    throw new Error(message);
  }
  console.warn(message);
}

try {
  main();
} catch (error) {
  console.error(`[spacy-setup] ${error.message}`);
  process.exit(1);
}
