const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");

test("export reads the response beside its task when a parent contains .json", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-export-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runner = path.join(root, "runner.cjs");
  const counter = path.join(root, "runs");
  fs.writeFileSync(runner, `
    const fs = require("node:fs");
    const path = require("node:path");
    const task = process.argv[2];
    fs.appendFileSync(${JSON.stringify(counter)}, "run\\n");
    const output = path.join(path.dirname(task), "fixture.pdf");
    fs.writeFileSync(output, "fixture export");
    fs.writeFileSync(task.replace(/\\.json$/i, ".response.json"), JSON.stringify({path: output}));
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
  for (const parent of ["ordinary", "parent.json.segment", "multiple.json.parts.json"]) {
    await t.test(parent, async () => {
      temp = path.join(root, parent);
      fs.mkdirSync(temp);
      fs.writeFileSync(counter, "");
      const result = await handler({}, "fixture-id", "fixture", "pdf");
      assert.deepEqual(result, { success: true, message: "Export completed." });
      assert.equal(fs.readFileSync(path.join(downloads, "fixture.pdf"), "utf8"), "fixture export");
      assert.equal(fs.readFileSync(counter, "utf8"), "run\n");
      assert.equal(fs.readdirSync(temp).some((name) => name.startsWith("export-")), false);
      fs.rmSync(path.join(downloads, "fixture.pdf"));
    });
  }
});
