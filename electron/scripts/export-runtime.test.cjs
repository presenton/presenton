const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");

async function runWindowsExport(format, spawnBehavior) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-export-runtime-"));
  const savedPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const savedEnv = { ...process.env };
  const originalLoad = Module._load;
  const modulePath = require.resolve("../app_dist/ipc/export_handlers");
  const calls = [];
  let handler;
  const downloads = path.join(directory, "downloads");
  fs.mkdirSync(downloads);
  const output = path.join(directory, `presentation.${format}`);
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnBehavior({ command, child, succeed() {
      fs.writeFileSync(output, "exported presentation");
      fs.writeFileSync(args[1].replace(".json", ".response.json"), JSON.stringify({ path: output }));
      queueMicrotask(() => child.emit("close", 0, null));
    } });
    return child;
  };
  const stubs = {
    electron: { ipcMain: { handle(name, callback) {
      assert.equal(name, "export-presentation");
      handler = callback;
    } } },
    "child_process": { spawn },
    "../utils/constants": {
      getAppDataDir: () => directory, getCacheDir: () => directory,
      getDownloadsDir: () => downloads, getTempDir: () => directory,
      resourceBaseDir: directory, isDev: false,
    },
    "../utils/dialog": { showFileDownloadedDialog: async () => {} },
    "../utils/safe-console": { safeLog() {}, safeError() {} },
    "../sentry/main": { addMainBreadcrumb() {} },
    "../utils": { killProcess() {} },
    "../utils/export-chromium": {
      isExportChromiumAvailable: () => true,
      removeBrokenExportChromiumCaches: async () => {},
      resolveLaunchableExportChromiumPath: async () => path.join(directory, "chrome.exe"),
    },
    "../utils/export-msix-runtime": { resolveExportSpawnTarget: async (_, scriptPath) => ({ scriptPath }) },
    "../utils/desktop-auth": { desktopCookieHeader: () => "" },
  };
  try {
    Object.defineProperty(process, "platform", { value: "win32" });
    delete process.env.EXPORT_NODE_BINARY;
    delete process.env.NODE_BINARY;
    process.env.NEXT_PUBLIC_URL = "http://127.0.0.1:3000";
    Module._load = function (name, ...args) {
      return Object.hasOwn(stubs, name) ? stubs[name] : originalLoad.call(this, name, ...args);
    };
    delete require.cache[modulePath];
    require(modulePath).setupExportHandlers();
    const result = await handler({}, "presentation-id", "Presentation", format);
    return {
      result, calls,
      downloaded: fs.existsSync(path.join(downloads, `presentation.${format}`)),
      tempDirectories: fs.readdirSync(directory).filter((name) => name.startsWith("export-")),
    };
  } finally {
    Module._load = originalLoad;
    Object.defineProperty(process, "platform", savedPlatform);
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    delete require.cache[modulePath];
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function spawnError(code) {
  return Object.assign(new Error(`spawn ${code}`), { code });
}

for (const format of ["pptx", "pdf"]) {
  test(`${format} export reaches Electron after Windows rejects node.cmd with EINVAL`, async () => {
    const { result, calls, downloaded, tempDirectories } = await runWindowsExport(format, ({ command, child, succeed }) => {
      if (command === "node.cmd") throw spawnError("EINVAL");
      if (command === process.execPath) return succeed();
      queueMicrotask(() => child.emit("error", spawnError("ENOENT")));
    });
    assert.deepEqual(result, { success: true, message: "Export completed." });
    assert.deepEqual(calls.map(({ command }) => command), ["node", "node.exe", "node.cmd", process.execPath]);
    assert.equal(calls.at(-1).options.env.ELECTRON_RUN_AS_NODE, "1");
    assert.ok(calls.every(({ options }) => !options.shell && options.windowsHide));
    assert.equal(downloaded, true);
    assert.deepEqual(tempDirectories, []);
  });
}

test("an emitted EINVAL also tries the next runtime", async () => {
  const { result, calls } = await runWindowsExport("pdf", ({ command, child, succeed }) => {
    if (command === "node.exe") return succeed();
    queueMicrotask(() => child.emit("error", spawnError("EINVAL")));
  });
  assert.equal(result.success, true);
  assert.deepEqual(calls.map(({ command }) => command), ["node", "node.exe"]);
});

test("exhausted runtimes report their failures and clean up the export task", async () => {
  const { result, calls, downloaded, tempDirectories } = await runWindowsExport("pdf", () => {
    throw spawnError("EINVAL");
  });
  assert.equal(result.success, false);
  assert.match(result.message, /Export failed to start with all runtimes/);
  assert.equal(calls.length, 4);
  assert.equal((result.message.match(/code=EINVAL/g) || []).length, 4);
  assert.equal(downloaded, false);
  assert.deepEqual(tempDirectories, []);
});

test("a launched export that fails is not retried with another runtime", async () => {
  const { result, calls } = await runWindowsExport("pdf", ({ child }) => {
    queueMicrotask(() => child.emit("close", 1, null));
  });
  assert.equal(result.success, false);
  assert.match(result.message, /Export process exited with code 1/);
  assert.deepEqual(calls.map(({ command }) => command), ["node"]);
});
