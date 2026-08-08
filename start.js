/* This script starts the FastAPI and Next.js servers, setting up user configuration if necessary. It reads environment variables to configure API keys and other settings, ensuring that the user configuration file is created if it doesn't exist. The script also handles the starting of both servers and keeps the Node.js process alive until one of the servers exits. */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { request } from "http";
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
import userConfigEnv from "./scripts/user-config-env.cjs";

const { buildUserConfigFromEnv, readUserConfigEnv } = userConfigEnv;

process.umask(0o022);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastapiDir = join(__dirname, "servers/fastapi");
const nextjsDir = join(__dirname, "servers/nextjs");
const nextjsStandaloneServer = join(nextjsDir, "server.js");
const nextjsCli = join(nextjsDir, "node_modules/next/dist/bin/next");
const exportSyncScript = join(__dirname, "scripts/sync-presentation-export.cjs");
const nginxSourceConfigPath = join(__dirname, "nginx.conf");
const nginxRuntimeConfigPath = "/etc/nginx/nginx.conf";

const args = process.argv.slice(2);
const hasDevArg = args.includes("--dev") || args.includes("-d");
const isDev = hasDevArg;
const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";

const fastapiPort = 8000;
const nextjsPort = 3000;
const appmcpPort = 8001;

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
  "templates",
  "pptx-to-html",
  "pptx-to-json",
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

const canLoadSharp = () => {
  const result = spawnSync(process.execPath, ["-e", "require('sharp')"], {
    cwd: __dirname,
    env: process.env,
    encoding: "utf8",
  });
  return result.status === 0;
};

const ensurePresentationExportNodeDependencies = async () => {
  if (canLoadSharp()) {
    return;
  }

  console.warn(
    "Sharp native dependency is missing for this container platform. Repairing root node_modules..."
  );
  await runCommand(
    "npm",
    ["install", "--include=optional", "--omit=dev", "--no-fund", "--no-audit"],
    { cwd: __dirname }
  );

  if (!canLoadSharp()) {
    throw new Error(
      "Sharp still cannot be loaded after npm install. Recreate Docker volumes with `docker compose down -v` and rebuild the development service."
    );
  }
};

const shouldSuppressStartupLogLine = (line) =>
  [
    /\bUvicorn running on\b/i,
    /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):(3000|8000)\b/i,
    /started server on .*:(3000|8000)\b/i,
  ].some((pattern) => pattern.test(line));

const forwardProcessOutput = (
  stream,
  target,
  { suppressStartupUrls = false } = {}
) => {
  if (!stream) {
    return;
  }
  let buffered = "";

  const writeLine = (line, ending = "\n") => {
    if (!suppressStartupUrls || !shouldSuppressStartupLogLine(line)) {
      target.write(line + ending);
    }
  };

  stream.on("data", (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      writeLine(line);
    }
  });

  stream.on("end", () => {
    if (buffered) {
      writeLine(buffered, "");
      buffered = "";
    }
  });
};

const waitForProcessOutputLine = (processName, childProcess, readinessRegexes) => {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const buffers = new Map();

    const settle = (callback, value) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      callback(value);
    };

    const inspectLine = (line) => {
      if (
        !isSettled &&
        readinessRegexes.some((readinessRegex) => readinessRegex.test(line))
      ) {
        settle(resolve);
      }
    };

    const inspectStream = (stream) => {
      if (!stream) {
        return;
      }
      buffers.set(stream, "");
      stream.on("data", (chunk) => {
        const buffered = buffers.get(stream) + chunk.toString();
        const lines = buffered.split(/\r?\n/);
        buffers.set(stream, lines.pop() ?? "");
        for (const line of lines) {
          inspectLine(line);
        }
      });
      stream.on("end", () => {
        const buffered = buffers.get(stream);
        if (buffered) {
          inspectLine(buffered);
        }
      });
    };

    inspectStream(childProcess.stdout);
    inspectStream(childProcess.stderr);

    childProcess.on("exit", (code) => {
      if (!isSettled) {
        settle(
          reject,
          new Error(`${processName} exited before reporting ready (exit code: ${code})`)
        );
      }
    });

    childProcess.on("error", (err) => {
      if (!isSettled) {
        settle(reject, err);
      }
    });
  });
};

const waitForProcessHttp = (
  processName,
  childProcess,
  port,
  path,
  host = "127.0.0.1",
  timeoutMs = 60_000
) => {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    let retryTimer;
    const deadline = Date.now() + timeoutMs;

    const settle = (callback, value) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      callback(value);
    };

    const retry = () => {
      if (Date.now() >= deadline) {
        settle(
          reject,
          new Error(
            `${processName} did not respond at http://${host}:${port}${path} within ${timeoutMs}ms`
          )
        );
        return;
      }
      retryTimer = setTimeout(checkHttp, 250);
    };

    const checkHttp = () => {
      let handled = false;
      const req = request(
        { host, port, path, method: "GET", timeout: 1_000 },
        (response) => {
          response.resume();
          finishAttempt(true);
        }
      );

      const finishAttempt = (isReady) => {
        if (handled) {
          return;
        }
        handled = true;
        req.destroy();
        if (isReady) {
          settle(resolve);
        } else if (!isSettled) {
          retry();
        }
      };

      req.once("error", () => finishAttempt(false));
      req.once("timeout", () => finishAttempt(false));
      req.end();
    };

    childProcess.on("exit", (code) => {
      if (!isSettled) {
        settle(
          reject,
          new Error(
            `${processName} exited before responding at http://${host}:${port}${path} (exit code: ${code})`
          )
        );
      }
    });

    childProcess.on("error", (err) => {
      if (!isSettled) {
        settle(reject, err);
      }
    });

    checkHttp();
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

const syncNginxConfigForDev = () => {
  if (!isDev || !existsSync(nginxSourceConfigPath)) {
    return;
  }

  try {
    copyFileSync(nginxSourceConfigPath, nginxRuntimeConfigPath);
    console.log("Synced nginx config from development bind mount");
  } catch (error) {
    console.warn("Failed to sync development nginx config:", error);
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
  const managedProcesses = new Set();
  let isShuttingDown = false;

  const shutdown = (exitCode) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    for (const childProcess of managedProcesses) {
      if (!childProcess.killed) {
        childProcess.kill();
      }
    }

    process.exit(exitCode);
  };

  process.once("SIGINT", () => shutdown(0));
  process.once("SIGTERM", () => shutdown(0));

  const spawnFastApiProcess = (stdio = ["ignore", "pipe", "pipe"]) =>
    spawn(
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
        stdio,
        env: process.env,
      }
    );

  const spawnNextjsProcess = (stdio = ["ignore", "pipe", "pipe"]) => {
    const useStandaloneNextjs = !isDev && existsSync(nextjsStandaloneServer);
    return spawn(
      process.execPath,
      useStandaloneNextjs
        ? [nextjsStandaloneServer]
        : [
            nextjsCli,
            isDev ? "dev" : "start",
            ...(isDev ? ["--webpack"] : []),
            "-H",
            "127.0.0.1",
            "-p",
            nextjsPort.toString(),
          ],
      {
        cwd: nextjsDir,
        stdio,
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
  };

  const watchManagedProcess = (name, childProcess, restart) => {
    managedProcesses.add(childProcess);

    childProcess.on("error", (err) => {
      console.error(`${name} process failed to start:`, err);
    });

    childProcess.on("exit", (code, signal) => {
      managedProcesses.delete(childProcess);
      if (isShuttingDown) {
        return;
      }

      const exitCode = typeof code === "number" ? code : signal ? 1 : 0;
      if (isDev && exitCode === 0 && restart) {
        console.warn(`${name} exited cleanly; restarting it for development.`);
        setTimeout(() => {
          if (!isShuttingDown) {
            restart();
          }
        }, 1000);
        return;
      }

      console.error(
        `${name} process exited. Exit code: ${exitCode}${
          signal ? `, signal: ${signal}` : ""
        }`
      );
      shutdown(exitCode);
    });
  };

  let fastApiProcess = spawnFastApiProcess();
  const restartFastApi = () => {
    fastApiProcess = spawnFastApiProcess(["ignore", "inherit", "inherit"]);
    watchManagedProcess("FastAPI", fastApiProcess, restartFastApi);
  };
  watchManagedProcess("FastAPI", fastApiProcess, restartFastApi);

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

  let nextjsProcess = spawnNextjsProcess();
  const restartNextjs = () => {
    nextjsProcess = spawnNextjsProcess(["ignore", "inherit", "inherit"]);
    watchManagedProcess("Next.js", nextjsProcess, restartNextjs);
  };
  watchManagedProcess("Next.js", nextjsProcess, restartNextjs);

  const nextjsReadyPromise = waitForProcessOutputLine("Next.js", nextjsProcess, [
    /Ready in\s+\d+/i,
    /started server on/i,
  ]);
  const fastApiReadyPromise = isDev
    ? waitForProcessOutputLine("FastAPI", fastApiProcess, [
        /Application startup complete\./i,
      ])
    : waitForProcessHttp(
        "FastAPI",
        fastApiProcess,
        fastapiPort,
        "/api/v1/auth/status"
      );

  const suppressStartupUrls = !isDev;
  forwardProcessOutput(fastApiProcess.stdout, process.stdout, {
    suppressStartupUrls,
  });
  forwardProcessOutput(fastApiProcess.stderr, process.stderr, {
    suppressStartupUrls,
  });
  forwardProcessOutput(nextjsProcess.stdout, process.stdout, {
    suppressStartupUrls,
  });
  forwardProcessOutput(nextjsProcess.stderr, process.stderr, {
    suppressStartupUrls,
  });

  const shouldStartOllamaRuntime = shouldStartOllama();
  const ollamaInstalled = isOllamaInstalled();

  if (shouldStartOllamaRuntime && ollamaInstalled) {
    const ollamaProcess = spawn("ollama", ["serve"], {
      cwd: "/",
      stdio: "inherit",
      env: process.env,
    });
    ollamaProcess.on("error", (err) => {
      console.error("Ollama process failed to start:", err);
    });
    watchManagedProcess("Ollama", ollamaProcess);
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
      mode: isDev ? "development" : "production",
      nextPort: nextjsPort,
      fastapiPort,
    });
  } catch (err) {
    console.warn(`Skipping startup banner: ${err.message}`);
  }

  await new Promise(() => {});
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
    await ensurePresentationExportNodeDependencies();
  }

  if (canChangeKeys) {
    setupUserConfigFromEnv();
  }

  syncNginxConfigForDev();

  const nginxReadyPromise = startNginx();
  startServers(nginxReadyPromise);
  await nginxReadyPromise;
};

main();
