import { ChildProcess, spawn } from "child_process";
import { getLogsDir, localhost } from "./constants";
import http from "http";
import fs from "fs";
import path from "path";
import { safeError, safeLog as safeConsoleLog } from "./safe-console";
import { memorySnapshotMb } from "./memory";
import { destroyChildProcessStdio, terminateChildProcess } from "./lifecycle";
import { killProcess } from "./index";

type ManagedServerProcess = {
  process: ChildProcess;
  ready: Promise<void>;
  stop: () => Promise<void>;
};

function resolveNextJsStandaloneServer(directory: string): {
  serverScript: string;
  cwd: string;
} {
  const directScript = path.join(directory, "server.js");
  if (fs.existsSync(directScript)) {
    return { serverScript: directScript, cwd: directory };
  }

  const nestedScript = path.join(directory, "servers", "nextjs", "server.js");
  if (fs.existsSync(nestedScript)) {
    return { serverScript: nestedScript, cwd: path.dirname(nestedScript) };
  }

  throw new Error(`Next.js standalone server not found under: ${directory}`);
}

/** Next.js 16+ standalone runs from servers/nextjs/; static/public must sit next to server.js. */
function ensureNestedStandaloneAssets(bundleRoot: string, serverCwd: string): void {
  if (path.resolve(bundleRoot) === path.resolve(serverCwd)) {
    return;
  }

  const copyIfMissing = (source: string, destination: string) => {
    if (!fs.existsSync(source) || fs.existsSync(destination)) {
      return;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
    safeConsoleLog(`[Presenton] Linked Next.js assets: ${path.basename(source)} -> ${destination}`);
  };

  copyIfMissing(
    path.join(bundleRoot, ".next-build", "static"),
    path.join(serverCwd, ".next-build", "static"),
  );
  copyIfMissing(
    path.join(bundleRoot, "public"),
    path.join(serverCwd, "public"),
  );
}

function createManagedServerProcess(params: {
  name: string;
  process: ChildProcess;
  readyUrl: string;
  cleanupListeners: () => void;
  markStopping?: (stopping: boolean) => void;
}): ManagedServerProcess {
  const abortController = new AbortController();
  let stopPromise: Promise<void> | null = null;

  const stop = async () => {
    if (stopPromise) {
      return stopPromise;
    }

    params.markStopping?.(true);
    abortController.abort();
    params.cleanupListeners();

    stopPromise = terminateChildProcess(
      params.process,
      params.name,
      killProcess,
    ).finally(() => {
      params.cleanupListeners();
      destroyChildProcessStdio(params.process);
    });

    return stopPromise;
  };

  return {
    process: params.process,
    ready: waitForServer(params.readyUrl, 120000, abortController.signal),
    stop,
  };
}

export async function startFastApiServer(
  directory: string,
  port: number,
  env: FastApiEnv,
  isDev: boolean,
) {
  // Start FastAPI server
  let command: string;
  let args: string[];

  if (isDev) {
    command = "uv";
    args = ["run", "python", "server.py", "--port", port.toString(), "--reload", "true"];
  } else {
    const binary = process.platform === "win32" ? "fastapi.exe" : "fastapi";
    command = path.join(directory, binary);
    args = ["--port", port.toString()];
  }

  const safeFileLog = (data: Buffer | string, logPath: string) => {
    try {
      fs.appendFileSync(logPath, data);
    } catch {
      /* ignore if logs dir not writable */
    }
  };
  const logsDir = getLogsDir();
  const fastapiLogPath = path.join(logsDir, "fastapi-server.log");

  const fastApiProcess = spawn(
    command,
    args,
    {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
      windowsHide: process.platform === "win32" && !isDev,
    }
  );
  const onFastApiStdoutData = (data: any) => {
    safeFileLog(data, fastapiLogPath);
    safeConsoleLog(`FastAPI: ${data}`);
  };
  const onFastApiStderrData = (data: any) => {
    safeFileLog(data, fastapiLogPath);
    safeError(`FastAPI: ${data}`);
  };
  const onFastApiError = (err: Error) => {
    safeFileLog(`Spawn error: ${err.message}\n`, fastapiLogPath);
  };
  fastApiProcess.stdout.on("data", onFastApiStdoutData);
  fastApiProcess.stderr.on("data", onFastApiStderrData);
  fastApiProcess.on("error", onFastApiError);
  safeConsoleLog("[Presenton] FastAPI process spawned:", {
    pid: fastApiProcess.pid,
    memory: memorySnapshotMb(),
  });
  const cleanupListeners = () => {
    fastApiProcess.stdout?.removeListener("data", onFastApiStdoutData);
    fastApiProcess.stderr?.removeListener("data", onFastApiStderrData);
    fastApiProcess.removeListener("error", onFastApiError);
  };

  return createManagedServerProcess({
    name: "FastAPI",
    process: fastApiProcess,
    readyUrl: `${localhost}:${port}/docs`,
    cleanupListeners,
  });
}

export async function startNextJsServer(
  directory: string,
  port: number,
  env: NextJsEnv,
  isDev: boolean,
) {
  let nextjsProcess: ChildProcess;
  let stopping = false;

  if (isDev) {
    // Windows: npm is npm.cmd; spawn() needs a shell or ENOENT.
    nextjsProcess = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", "-H", "127.0.0.1", "-p", port.toString()],
      {
        cwd: directory,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...env },
        shell: process.platform === "win32",
      }
    );
    const nextjsLogPath = path.join(getLogsDir(), "nextjs-server.log");
    const safeNextLog = (d: Buffer | string) => {
      try {
        fs.appendFileSync(nextjsLogPath, d);
      } catch {
        /* ignore */
      }
    };
    const onStdoutData = (data: any) => {
      safeNextLog(data);
      safeConsoleLog(`NextJS: ${data}`);
    };
    const onStderrData = (data: any) => {
      safeNextLog(data);
      safeError(`NextJS: ${data}`);
    };
    const onError = (err: Error) => {
      safeNextLog(`Spawn error: ${err.message}\n`);
      safeError(`NextJS spawn error: ${err.message}`);
    };
    const onExit = (code: number | null, signal: string | null) => {
      if (stopping) {
        return;
      }
      safeError(`NextJS process exited unexpectedly: code=${code}, signal=${signal}`);
    };
    nextjsProcess.stdout?.on("data", onStdoutData);
    nextjsProcess.stderr?.on("data", onStderrData);
    nextjsProcess.on("error", onError);
    nextjsProcess.on("exit", onExit);

    const cleanupListeners = () => {
      nextjsProcess.stdout?.removeListener("data", onStdoutData);
      nextjsProcess.stderr?.removeListener("data", onStderrData);
      nextjsProcess.removeListener("error", onError);
      nextjsProcess.removeListener("exit", onExit);
    };

    return createManagedServerProcess({
      name: "NextJS",
      process: nextjsProcess,
      readyUrl: `${localhost}:${port}`,
      cleanupListeners,
      markStopping: (value) => {
        stopping = value;
      },
    });
  } else {
    const { serverScript, cwd } = resolveNextJsStandaloneServer(directory);
    ensureNestedStandaloneAssets(directory, cwd);

    nextjsProcess = spawn(
      process.execPath,
      [serverScript],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ...env,
          ELECTRON_RUN_AS_NODE: "1",
          HOSTNAME: "127.0.0.1",
          PORT: port.toString(),
        },
        windowsHide: process.platform === "win32",
      }
    );
    const nextjsLogPath = path.join(getLogsDir(), "nextjs-server.log");
    const safeNextLog = (d: Buffer | string) => {
      try {
        fs.appendFileSync(nextjsLogPath, d);
      } catch {
        /* ignore */
      }
    };
    const onStdoutData = (data: any) => {
      safeNextLog(data);
      safeConsoleLog(`NextJS: ${data}`);
    };
    const onStderrData = (data: any) => {
      safeNextLog(data);
      safeError(`NextJS: ${data}`);
    };
    const onError = (err: Error) => {
      safeNextLog(`Spawn error: ${err.message}\n`);
      safeError(`NextJS spawn error: ${err.message}`);
    };
    const onExit = (code: number | null, signal: string | null) => {
      if (stopping) {
        return;
      }
      safeError(`NextJS process exited unexpectedly: code=${code}, signal=${signal}`);
    };
    nextjsProcess.stdout?.on("data", onStdoutData);
    nextjsProcess.stderr?.on("data", onStderrData);
    nextjsProcess.on("error", onError);
    nextjsProcess.on("exit", onExit);

    const cleanupListeners = () => {
      nextjsProcess.stdout?.removeListener("data", onStdoutData);
      nextjsProcess.stderr?.removeListener("data", onStderrData);
      nextjsProcess.removeListener("error", onError);
      nextjsProcess.removeListener("exit", onExit);
    };

    return createManagedServerProcess({
      name: "NextJS",
      process: nextjsProcess,
      readyUrl: `${localhost}:${port}`,
      cleanupListeners,
      markStopping: (value) => {
        stopping = value;
      },
    });
  }
}


function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Server wait aborted"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      cleanup();
      callback();
    };
    const onAbort = () => {
      finish(() => reject(new Error("Server wait aborted")));
    };
    const timer = setTimeout(() => finish(resolve), delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForServer(url: string, timeout = 120000, signal?: AbortSignal): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (signal?.aborted) {
      throw new Error("Server wait aborted");
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const req = http.get(url, (res) => {
          cleanup();
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            finish(resolve);
          } else {
            finish(() => reject(new Error(`Unexpected status code: ${res.statusCode}`)));
          }
        });

        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          callback();
        };

        const onError = (error: Error) => finish(() => reject(error));
        const onAbort = () => {
          req.on("error", () => {});
          req.destroy();
          finish(() => reject(new Error("Server wait aborted")));
        };
        const onTimeout = () => {
          req.on("error", () => {});
          req.destroy();
          finish(() => reject(new Error('Request timed out')));
        };
        const cleanup = () => {
          req.removeListener("error", onError);
          signal?.removeEventListener("abort", onAbort);
        };

        req.on('error', onError);
        req.setTimeout(5000, onTimeout);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      return;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      await abortableDelay(1000, signal);
    }
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}
