/* This script starts the FastAPI and Next.js servers, setting up user configuration if necessary. It reads environment variables to configure API keys and other settings, ensuring that the user configuration file is created if it doesn't exist. The script also handles the starting of both servers and keeps the Node.js process alive until one of the servers exits. */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { printPresentonStartupBanner } from "./scripts/presenton-terminal-banner.mjs";

process.umask(0o022);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastapiDir = join(__dirname, "servers/fastapi");
const nextjsDir = join(__dirname, "servers/nextjs");
const nextjsStandaloneServer = join(nextjsDir, "server.js");
const exportSyncScript = join(__dirname, "scripts/sync-presentation-export.cjs");

const args = process.argv.slice(2);
const hasDevArg = args.includes("--dev") || args.includes("-d");
const isDev = hasDevArg;
const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";

const fastapiPort = 8000;
const nextjsPort = 3000;
const appmcpPort = 8001;
/** Must match `listen` in nginx.conf (public HTTP inside the container). */
const nginxListenPort = 80;

const appDataDirectory = process.env.APP_DATA_DIRECTORY;
if (!appDataDirectory) {
  throw new Error("APP_DATA_DIRECTORY is required");
}

const appDataDirectoryMode = 0o755;
const userConfigPath = join(appDataDirectory, "userConfig.json");
const userConfigBackupPath = `${userConfigPath}.bak`;
const userDataDir = dirname(userConfigPath);
const appDataStaticDirectories = [
  "exports",
  "images",
  "uploads",
  "fonts",
  "pptx-to-html",
].map((name) => join(appDataDirectory, name));

const ensureReadableDirectory = (dirPath) => {
  mkdirSync(dirPath, { recursive: true, mode: appDataDirectoryMode });
  chmodSync(dirPath, appDataDirectoryMode);
};

const ensureReadableExportFiles = (dirPath) => {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      chmodSync(entryPath, appDataDirectoryMode);
      ensureReadableExportFiles(entryPath);
    } else if (entry.isFile()) {
      chmodSync(entryPath, 0o644);
    }
  }
};

const ensureAppDataDirectories = () => {
  ensureReadableDirectory(userDataDir);
  for (const dirPath of appDataStaticDirectories) {
    ensureReadableDirectory(dirPath);
  }
  ensureReadableExportFiles(join(appDataDirectory, "exports"));
};

ensureAppDataDirectories();

const readJsonConfig = (filePath) => {
  try {
    if (!existsSync(filePath)) {
      return undefined;
    }
    const raw = readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
};

const readUserConfig = () =>
  readJsonConfig(userConfigPath) || readJsonConfig(userConfigBackupPath) || {};

const copyUserConfigBackup = () => {
  try {
    if (readJsonConfig(userConfigPath)) {
      copyFileSync(userConfigPath, userConfigBackupPath);
      chmodSync(userConfigBackupPath, 0o644);
    }
  } catch (error) {
    console.warn("Failed to update user config backup:", error);
  }
};

const writeUserConfig = (config) => {
  ensureReadableDirectory(userDataDir);
  copyUserConfigBackup();

  const tempPath = `${userConfigPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const fd = openSync(tempPath, "w");
  try {
    writeFileSync(fd, JSON.stringify(config), "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  try {
    renameSync(tempPath, userConfigPath);
    chmodSync(userConfigPath, 0o644);
    if (!existsSync(userConfigBackupPath)) {
      copyUserConfigBackup();
    }
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }
};

// Setup node_modules for development
const setupNodeModules = () => {
  return new Promise((resolve, reject) => {
    console.log("Setting up node_modules for Next.js...");
    const npmProcess = spawn("npm", ["install"], {
      cwd: nextjsDir,
      stdio: "inherit",
      env: process.env,
    });

    npmProcess.on("error", (err) => {
      console.error("npm install failed:", err);
      reject(err);
    });

    npmProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("npm install completed successfully");
        resolve();
      } else {
        console.error(`npm install failed with exit code: ${code}`);
        reject(new Error(`npm install failed with exit code: ${code}`));
      }
    });
  });
};

const runCommand = (command, commandArgs, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || __dirname,
      stdio: options.stdio || "inherit",
      env: options.env || process.env,
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code: ${code}`));
      }
    });
  });
};

const runNodeScript = (scriptPath, scriptArgs) => {
  return runCommand(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: __dirname,
  });
};

const forwardProcessOutput = (stream, target, onChunk) => {
  if (!stream) {
    return;
  }
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    target.write(text);
    onChunk?.(text);
  });
};

const waitForProcessReady = (processName, childProcess, readinessRegexes = []) => {
  if (readinessRegexes.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let isReady = false;

    const markReady = (text) => {
      if (isReady) {
        return;
      }
      if (readinessRegexes.some((regex) => regex.test(text))) {
        isReady = true;
        resolve();
      }
    };

    forwardProcessOutput(childProcess.stdout, process.stdout, markReady);
    forwardProcessOutput(childProcess.stderr, process.stderr, markReady);

    childProcess.on("exit", (code) => {
      if (!isReady) {
        reject(
          new Error(`${processName} exited before reporting ready (exit code: ${code})`)
        );
      }
    });

    childProcess.on("error", (err) => {
      if (!isReady) {
        reject(err);
      }
    });
  });
};

const isTruthyEnv = (value) => {
  if (value == null) {
    return false;
  }

  return !["", "0", "false", "no", "off"].includes(
    String(value).trim().toLowerCase()
  );
};

const isOllamaInstalled = () =>
  existsSync("/usr/bin/ollama") || existsSync("/usr/local/bin/ollama");

const shouldStartOllama = () => isTruthyEnv(process.env.START_OLLAMA);

const ensureOllamaRuntime = async () => {
  if (!shouldStartOllama() || isOllamaInstalled()) {
    return;
  }

  console.log("START_OLLAMA=true; installing Ollama runtime...");
  await runCommand("sh", ["-c", "curl -fsSL https://ollama.com/install.sh | sh"], {
    cwd: "/",
  });
};

const ensurePresentationExportRuntime = async () => {
  if (process.env.ENSURE_PRESENTATION_EXPORT_RUNTIME === "false") {
    return;
  }

  if (!existsSync(exportSyncScript)) {
    console.warn("presentation-export sync script not found; skipping runtime check");
    return;
  }

  try {
    await runNodeScript(exportSyncScript, ["--check-only"]);
  } catch (err) {
    if (!isDev) {
      throw new Error(
        "presentation-export runtime is missing in this container image. Rebuild the image so the runtime package is installed."
      );
    }

    console.warn("presentation-export runtime missing in dev mount. Syncing runtime package...");
    await runNodeScript(exportSyncScript, ["--force"]);
  }
};

process.env.USER_CONFIG_PATH = userConfigPath;
// Let Next.js middleware reach FastAPI over the loopback interface inside the
// container without having to bounce through nginx (the host-facing port is
// not reachable from inside the Next.js process).
if (!process.env.FAST_API_INTERNAL_URL) {
  process.env.FAST_API_INTERNAL_URL = `http://127.0.0.1:${fastapiPort}`;
}

//? UserConfig is only setup if API Keys can be changed
const setupUserConfigFromEnv = () => {
  let existingConfig = readUserConfig();

  if (!["ollama", "openai", "google", "vertex", "azure", "bedrock", "openrouter", "fireworks", "together", "cerebras", "anthropic", "litellm", "lmstudio", "custom", "codex"].includes(existingConfig.LLM)) {
    existingConfig.LLM = undefined;
  }

  const envValue = (key) => {
    const value = process.env[key];
    return value === undefined || value === "" ? undefined : value;
  };

  const configValue = (key) => envValue(key) ?? existingConfig[key];

  const parseBooleanLike = (value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
    return undefined;
  };

  const normalizeImageConfig = (config) => {
    const parsedDisableImageGeneration = parseBooleanLike(
      config.DISABLE_IMAGE_GENERATION
    );
    if (parsedDisableImageGeneration !== undefined) {
      config.DISABLE_IMAGE_GENERATION = parsedDisableImageGeneration;
    }

    if (config.DISABLE_IMAGE_GENERATION || config.IMAGE_PROVIDER) {
      return config;
    }

    if (
      config.OPENAI_COMPAT_IMAGE_BASE_URL &&
      config.OPENAI_COMPAT_IMAGE_API_KEY &&
      config.OPENAI_COMPAT_IMAGE_MODEL
    ) {
      config.IMAGE_PROVIDER = "openai_compatible";
    } else if (config.OPEN_WEBUI_IMAGE_URL) {
      config.IMAGE_PROVIDER = "open_webui";
    } else if (config.COMFYUI_URL) {
      config.IMAGE_PROVIDER = "comfyui";
    } else if (config.PEXELS_API_KEY) {
      config.IMAGE_PROVIDER = "pexels";
    } else if (config.PIXABAY_API_KEY) {
      config.IMAGE_PROVIDER = "pixabay";
    } else if (config.LLM === "openai" && config.OPENAI_API_KEY) {
      config.IMAGE_PROVIDER = "gpt-image-1.5";
      config.GPT_IMAGE_1_5_QUALITY = config.GPT_IMAGE_1_5_QUALITY || "medium";
    } else if (config.LLM === "google" && config.GOOGLE_API_KEY) {
      config.IMAGE_PROVIDER = "gemini_flash";
    } else {
      config.DISABLE_IMAGE_GENERATION = true;
    }

    return config;
  };

  const userConfig = {
    LLM: process.env.LLM || existingConfig.LLM,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || existingConfig.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || existingConfig.OPENAI_MODEL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || existingConfig.GOOGLE_API_KEY,
    GOOGLE_MODEL: process.env.GOOGLE_MODEL || existingConfig.GOOGLE_MODEL,
    VERTEX_API_KEY: process.env.VERTEX_API_KEY || existingConfig.VERTEX_API_KEY,
    VERTEX_MODEL: process.env.VERTEX_MODEL || existingConfig.VERTEX_MODEL,
    VERTEX_PROJECT: process.env.VERTEX_PROJECT || existingConfig.VERTEX_PROJECT,
    VERTEX_LOCATION: process.env.VERTEX_LOCATION || existingConfig.VERTEX_LOCATION,
    VERTEX_BASE_URL: process.env.VERTEX_BASE_URL || existingConfig.VERTEX_BASE_URL,
    AZURE_OPENAI_API_KEY:
      process.env.AZURE_OPENAI_API_KEY || existingConfig.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_MODEL:
      process.env.AZURE_OPENAI_MODEL || existingConfig.AZURE_OPENAI_MODEL,
    AZURE_OPENAI_ENDPOINT:
      process.env.AZURE_OPENAI_ENDPOINT || existingConfig.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_BASE_URL:
      process.env.AZURE_OPENAI_BASE_URL || existingConfig.AZURE_OPENAI_BASE_URL,
    AZURE_OPENAI_API_VERSION:
      process.env.AZURE_OPENAI_API_VERSION || existingConfig.AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT:
      process.env.AZURE_OPENAI_DEPLOYMENT || existingConfig.AZURE_OPENAI_DEPLOYMENT,
    BEDROCK_REGION: process.env.BEDROCK_REGION || existingConfig.BEDROCK_REGION,
    BEDROCK_API_KEY: process.env.BEDROCK_API_KEY || existingConfig.BEDROCK_API_KEY,
    BEDROCK_AWS_ACCESS_KEY_ID:
      process.env.BEDROCK_AWS_ACCESS_KEY_ID || existingConfig.BEDROCK_AWS_ACCESS_KEY_ID,
    BEDROCK_AWS_SECRET_ACCESS_KEY:
      process.env.BEDROCK_AWS_SECRET_ACCESS_KEY || existingConfig.BEDROCK_AWS_SECRET_ACCESS_KEY,
    BEDROCK_AWS_SESSION_TOKEN:
      process.env.BEDROCK_AWS_SESSION_TOKEN || existingConfig.BEDROCK_AWS_SESSION_TOKEN,
    BEDROCK_PROFILE_NAME:
      process.env.BEDROCK_PROFILE_NAME || existingConfig.BEDROCK_PROFILE_NAME,
    BEDROCK_MODEL: process.env.BEDROCK_MODEL || existingConfig.BEDROCK_MODEL,
    FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY || existingConfig.FIREWORKS_API_KEY,
    FIREWORKS_MODEL: process.env.FIREWORKS_MODEL || existingConfig.FIREWORKS_MODEL,
    FIREWORKS_BASE_URL: process.env.FIREWORKS_BASE_URL || existingConfig.FIREWORKS_BASE_URL,
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || existingConfig.TOGETHER_API_KEY,
    TOGETHER_MODEL: process.env.TOGETHER_MODEL || existingConfig.TOGETHER_MODEL,
    TOGETHER_BASE_URL: process.env.TOGETHER_BASE_URL || existingConfig.TOGETHER_BASE_URL,
    OLLAMA_URL: process.env.OLLAMA_URL || existingConfig.OLLAMA_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || existingConfig.OLLAMA_MODEL,
    ANTHROPIC_API_KEY:
      process.env.ANTHROPIC_API_KEY || existingConfig.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL:
      process.env.ANTHROPIC_MODEL || existingConfig.ANTHROPIC_MODEL,
    CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL || existingConfig.CUSTOM_LLM_URL,
    CUSTOM_LLM_API_KEY:
      process.env.CUSTOM_LLM_API_KEY || existingConfig.CUSTOM_LLM_API_KEY,
    CUSTOM_MODEL: process.env.CUSTOM_MODEL || existingConfig.CUSTOM_MODEL,
    LITELLM_BASE_URL: process.env.LITELLM_BASE_URL || existingConfig.LITELLM_BASE_URL,
    LITELLM_API_KEY: process.env.LITELLM_API_KEY || existingConfig.LITELLM_API_KEY,
    LITELLM_MODEL: process.env.LITELLM_MODEL || existingConfig.LITELLM_MODEL,
    LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || existingConfig.LMSTUDIO_BASE_URL,
    LMSTUDIO_API_KEY: process.env.LMSTUDIO_API_KEY || existingConfig.LMSTUDIO_API_KEY,
    LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL || existingConfig.LMSTUDIO_MODEL,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || existingConfig.PEXELS_API_KEY,
    PIXABAY_API_KEY:
      process.env.PIXABAY_API_KEY || existingConfig.PIXABAY_API_KEY,
    IMAGE_PROVIDER: process.env.IMAGE_PROVIDER || existingConfig.IMAGE_PROVIDER,
    DISABLE_IMAGE_GENERATION:
      configValue("DISABLE_IMAGE_GENERATION") ?? existingConfig.DISABLE_IMAGE_GENERATION,
    DISABLE_THINKING:
      process.env.DISABLE_THINKING || existingConfig.DISABLE_THINKING,
    EXTENDED_REASONING:
      process.env.EXTENDED_REASONING || existingConfig.EXTENDED_REASONING,
    WEB_GROUNDING: process.env.WEB_GROUNDING || existingConfig.WEB_GROUNDING,
    USE_CUSTOM_URL: process.env.USE_CUSTOM_URL || existingConfig.USE_CUSTOM_URL,
    COMFYUI_URL: process.env.COMFYUI_URL || existingConfig.COMFYUI_URL,
    COMFYUI_WORKFLOW:
      process.env.COMFYUI_WORKFLOW || existingConfig.COMFYUI_WORKFLOW,
    DALL_E_3_QUALITY:
      process.env.DALL_E_3_QUALITY || existingConfig.DALL_E_3_QUALITY,
    GPT_IMAGE_1_5_QUALITY:
      process.env.GPT_IMAGE_1_5_QUALITY || existingConfig.GPT_IMAGE_1_5_QUALITY,
    CODEX_MODEL: process.env.CODEX_MODEL || existingConfig.CODEX_MODEL,
    CODEX_ACCESS_TOKEN: existingConfig.CODEX_ACCESS_TOKEN,
    CODEX_REFRESH_TOKEN: existingConfig.CODEX_REFRESH_TOKEN,
    CODEX_TOKEN_EXPIRES: existingConfig.CODEX_TOKEN_EXPIRES,
    CODEX_ACCOUNT_ID: existingConfig.CODEX_ACCOUNT_ID,
    AUTH_USERNAME: existingConfig.AUTH_USERNAME,
    AUTH_PASSWORD_HASH: existingConfig.AUTH_PASSWORD_HASH,
    AUTH_SECRET_KEY: existingConfig.AUTH_SECRET_KEY,
  };

  writeFileSync(userConfigPath, JSON.stringify(normalizeImageConfig(userConfig)));
};

const startServers = async (nginxReadyPromise) => {
  const fastApiProcess = spawn(
    "python",
    [
      "server.py",
      "--port",
      fastapiPort.toString(),
      "--reload",
      isDev ? "true" : "false",
    ],
    {
      cwd: fastapiDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }
  );

  fastApiProcess.on("error", (err) => {
    console.error("FastAPI process failed to start:", err);
  });

  const appmcpProcess = spawn(
    "python",
    ["mcp_server.py", "--port", appmcpPort.toString()],
    {
      cwd: fastapiDir,
      stdio: "ignore",
      env: process.env,
    }
  );

  appmcpProcess.on("error", (err) => {
    console.error("App MCP process failed to start:", err);
  });

  const useStandaloneNextjs = !isDev && existsSync(nextjsStandaloneServer);

  const nextjsProcess = spawn(
    useStandaloneNextjs ? process.execPath : "npm",
    useStandaloneNextjs
      ? [nextjsStandaloneServer]
      : [
          "run",
          isDev ? "dev" : "start",
          "--",
          "-H",
          "127.0.0.1",
          "-p",
          nextjsPort.toString(),
        ],
    {
      cwd: nextjsDir,
      stdio: ["ignore", "pipe", "pipe"],
      env:
        useStandaloneNextjs
          ? {
              ...process.env,
              HOSTNAME: "127.0.0.1",
              PORT: nextjsPort.toString(),
            }
          : process.env,
    }
  );

  nextjsProcess.on("error", (err) => {
    console.error("Next.js process failed to start:", err);
  });

  const shouldStartOllamaRuntime = shouldStartOllama();
  const ollamaInstalled = isOllamaInstalled();

  const fastApiReadyPromise = waitForProcessReady("FastAPI", fastApiProcess, [
    /Application startup complete\./i,
  ]);
  const nextjsReadyPromise = waitForProcessReady("Next.js", nextjsProcess, [
    /Ready in\s+\d+/i,
    /started server on/i,
  ]);

  const exitPromises = [
    new Promise((resolve) => fastApiProcess.on("exit", resolve)),
    new Promise((resolve) => nextjsProcess.on("exit", resolve)),
  ];

  if (shouldStartOllamaRuntime && ollamaInstalled) {
    const ollamaProcess = spawn("ollama", ["serve"], {
      cwd: "/",
      stdio: "inherit",
      env: process.env,
    });
    ollamaProcess.on("error", (err) => {
      console.error("Ollama process failed to start:", err);
    });
    exitPromises.push(new Promise((resolve) => ollamaProcess.on("exit", resolve)));
  } else if (shouldStartOllamaRuntime) {
    console.log(
      "Ollama requested, but the binary is not installed. Set START_OLLAMA=true to install it at startup, or set OLLAMA_URL to a remote daemon."
    );
  } else {
    console.log(
      "Ollama disabled (START_OLLAMA=false); use OLLAMA_URL for a remote daemon if needed."
    );
  }

  try {
    await Promise.all([fastApiReadyPromise, nextjsReadyPromise, nginxReadyPromise]);
    printPresentonStartupBanner({
      nextPort: nextjsPort,
      fastapiPort,
      nginxInternalPort: nginxListenPort,
    });
  } catch (err) {
    console.warn(`Skipping startup banner: ${err.message}`);
  }

  // Keep the Node process alive until one of the servers exits
  const exitCode = await Promise.race(exitPromises);

  console.log(`One of the processes exited. Exit code: ${exitCode}`);
  process.exit(exitCode);
};

// Start nginx service (reverse proxy: see nginx.conf listen + upstream ports)
const startNginx = () => {
  return new Promise((resolve) => {
    const nginxProcess = spawn("service", ["nginx", "start"], {
      stdio: "inherit",
      env: process.env,
    });

    nginxProcess.on("error", (err) => {
      console.error("Nginx process failed to start:", err);
      resolve(false);
    });

    nginxProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("Nginx started successfully");
        resolve(true);
      } else {
        console.error(`Nginx failed to start with exit code: ${code}`);
        resolve(false);
      }
    });
  });
};

const main = async () => {
  await ensurePresentationExportRuntime();
  await ensureOllamaRuntime();

  if (isDev) {
    await setupNodeModules();
  }

  if (canChangeKeys) {
    setupUserConfigFromEnv();
  }

  const nginxReadyPromise = startNginx();
  startServers(nginxReadyPromise);
  await nginxReadyPromise;
};

main();
