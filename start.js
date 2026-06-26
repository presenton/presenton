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
import {
  buildUserConfigFromEnv,
  readUserConfigEnv,
} from "./scripts/user-config-env.mjs";

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
  const existingConfig = readUserConfig();
  const envConfig = readUserConfigEnv(process.env);
  if (Object.keys(existingConfig).length > 0 && Object.keys(envConfig).length === 0) {
    return;
  }
  writeUserConfig(buildUserConfigFromEnv(existingConfig, process.env));
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
