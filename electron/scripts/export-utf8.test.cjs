const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");

test("export errors preserve UTF-8 split across child output chunks", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-export-utf8-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runner = path.join(root, "runner.cjs");
  const diagnostic = "导出失败 🙂 café";
  fs.writeFileSync(runner, `
    const fs = require("node:fs");
    const { title: stream } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const bytes = Buffer.from(${JSON.stringify(diagnostic)});
    let index = 0;
    const timer = setInterval(() => {
      if (index === bytes.length) {
        clearInterval(timer);
        process.exitCode = 23;
        return;
      }
      process[stream].write(bytes.subarray(index, ++index));
    }, 10);
  `);
  let temp;
  let handler;
  const downloads = path.join(root, "downloads");
  fs.mkdirSync(downloads);
  const originalLoad = Module._load;
  Module._load = function (name, parent, ...args) {
    if (parent?.filename.endsWith(path.join("ipc", "export_handlers.js"))) {
      if (name === "electron") return { ipcMain: { handle: (_, callback) => { handler = callback; } } };
      if (name === "../utils/constants") return {
        getTempDir: () => temp, getAppDataDir: () => root, getCacheDir: () => root,
        getDownloadsDir: () => downloads, resourceBaseDir: root, isDev: true,
      };
      if (name === "../utils/dialog") return { showFileDownloadedDialog: async () => {} };
      if (name === "../utils/safe-console") return { safeLog() {}, safeError() {} };
      if (name === "../sentry/main") return { addMainBreadcrumb() {} };
      if (name === "../utils/export-chromium") return {
        removeBrokenExportChromiumCaches: async () => {}, isExportChromiumAvailable: () => true,
        resolveLaunchableExportChromiumPath: async () => process.execPath,
      };
      if (name === "../utils/export-msix-runtime") return { resolveExportSpawnTarget: async () => ({ scriptPath: runner }) };
      if (name === "../utils/desktop-auth") return { desktopCookieHeader: () => "" };
      if (name === "../utils") return { killProcess() {} };
    }
    return originalLoad.call(this, name, parent, ...args);
  };
  try {
    const modulePath = require.resolve("../app_dist/ipc/export_handlers");
    delete require.cache[modulePath];
    require(modulePath).setupExportHandlers();
  } finally { Module._load = originalLoad; }


  const savedNode = process.env.EXPORT_NODE_BINARY;
  process.env.EXPORT_NODE_BINARY = process.execPath;
  t.after(() => {
    if (savedNode === undefined) delete process.env.EXPORT_NODE_BINARY;
    else process.env.EXPORT_NODE_BINARY = savedNode;
  });
  for (const stream of ["stdout", "stderr"]) {
    await t.test(stream, async () => {
      temp = path.join(root, stream);
      fs.mkdirSync(temp);
      const result = await handler({}, "fixture-id", stream, "pdf");
      assert.equal(result.success, false);
      assert.ok(result.message.includes(diagnostic), result.message);
      assert.ok(!result.message.includes("\uFFFD"), result.message);
      assert.equal(fs.readdirSync(temp).some((name) => name.startsWith("export-")), false);
    });
  }
});
