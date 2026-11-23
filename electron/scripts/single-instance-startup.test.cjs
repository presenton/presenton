const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const test = require("node:test");

for (const primary of [false, true]) {
  test(`${primary ? "primary" : "secondary"} instance startup initializes only its own runtime`, () => {
    const calls = { quit: 0, paths: 0, recovery: 0, sentry: 0, ready: 0 };
    const app = {
      commandLine: { appendSwitch() {} }, disableHardwareAcceleration() {},
      requestSingleInstanceLock: () => primary,
      quit: () => { calls.quit++; }, on() {},
      whenReady: () => { calls.ready++; return new Promise(() => {}); },
    };
    const mocks = {
      dotenv: { config() {} }, electron: { app },
      "./utils/constants": {
        initializeAppPaths: () => { calls.paths++; return { cacheDir: "fixture-cache", userDataDir: "fixture-profile" }; },
      },
      "./utils/chromium-cache-recovery": {
        prepareChromiumCacheRecovery: () => { calls.recovery++; return { status: "fixture" }; },
      },
      "./sentry/main": { initMainSentry: () => { calls.sentry++; }, setMainSentryRuntimeContext() {}, addMainBreadcrumb() {} },
      "./utils/safe-console": { installSafeConsole() {}, safeLog() {} },
      "./utils/memory": { memorySnapshotMb: () => ({}) },
    };
    const filename = require.resolve("../app_dist/main");
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = module.paths;
    const originalLoad = Module._load;
    try {
      Module._load = function (name, parent, ...args) {
        if (parent?.filename === filename) {
          if (Object.hasOwn(mocks, name)) return mocks[name];
          if (name.startsWith("./")) return {};
        }
        return originalLoad.call(this, name, parent, ...args);
      };
      loaded._compile(fs.readFileSync(filename, "utf8"), filename);
    } finally { Module._load = originalLoad; }
    assert.deepEqual(calls, primary
      ? { quit: 0, paths: 1, recovery: 1, sentry: 1, ready: 1 }
      : { quit: 1, paths: 0, recovery: 0, sentry: 0, ready: 0 });
  });
}
