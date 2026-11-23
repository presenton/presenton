const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const { ensurePrivateDirectory, writePrivateFileSync } = require("../app_dist/utils/private-storage");
const { updateUserConfigFile, readUserConfigFile } = require("../app_dist/utils/user-config-store");

const posix = { skip: typeof process.getuid !== "function" ? "POSIX ownership/modes" : false };
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-private-storage-")); });
test.after(() => { fs.rmSync(directory, { recursive: true, force: true }); });
const mode = (file) => fs.statSync(file).mode & 0o777;

test("private directories migrate readable legacy modes while preserving data", posix, () => {
  const root = path.join(directory, "legacy");
  fs.mkdirSync(root, { mode: 0o755 });
  fs.writeFileSync(path.join(root, "kept.txt"), "kept");
  assert.equal(ensurePrivateDirectory(root), fs.realpathSync(root));
  assert.equal(mode(root), 0o700);
  assert.equal(fs.readFileSync(path.join(root, "kept.txt"), "utf8"), "kept");
});

test("private directories reject shared writable parents without changing them", posix, () => {
  const shared = path.join(directory, "shared");
  fs.mkdirSync(shared);
  fs.chmodSync(shared, 0o777);
  const child = path.join(shared, "private");
  // Model a public temp root: this test workspace itself is intentionally 0700.
  const original = fs.statSync;
  fs.statSync = function (filename, ...args) {
    const stat = original.call(fs, filename, ...args);
    if (filename !== shared && (stat.mode & 0o077) === 0) stat.mode |= 0o055;
    return stat;
  };
  try { assert.throws(() => ensurePrivateDirectory(child), /writable parent/); }
  finally { fs.statSync = original; }
  assert.equal(mode(shared), 0o777);
  assert.equal(fs.existsSync(child), false);
});

test("private directories reject paths owned by another user", posix, () => {
  const target = path.join(directory, "other-user");
  fs.mkdirSync(target);
  const original = fs.lstatSync;
  fs.lstatSync = function (filename, ...args) {
    const stat = original.call(fs, filename, ...args);
    if (filename === target) stat.uid = process.getuid() + 1;
    return stat;
  };
  try { assert.throws(() => ensurePrivateDirectory(target), /another user/); }
  finally { fs.lstatSync = original; }
});

test("a private home keeps existing data safe below a group-writable config directory", posix, () => {
  const home = path.join(directory, "private-home");
  fs.mkdirSync(home, { mode: 0o700 });
  const configBase = path.join(home, ".config");
  fs.mkdirSync(configBase);
  fs.chmodSync(configBase, 0o770);
  const userData = path.join(configBase, "Presenton Open Source");
  fs.mkdirSync(userData);
  const config = path.join(userData, "userConfig.json");
  fs.writeFileSync(config, JSON.stringify({ token: "existing" }));
  assert.equal(ensurePrivateDirectory(userData), fs.realpathSync(userData));
  assert.equal(readUserConfigFile(config).token, "existing");
});

test("owned storage links resolve to a private canonical location", posix, () => {
  const target = path.join(directory, "linked-storage");
  fs.mkdirSync(target);
  const alias = path.join(directory, "storage-link");
  fs.symlinkSync(target, alias);
  assert.equal(ensurePrivateDirectory(alias), fs.realpathSync(target));
  assert.equal(mode(target), 0o700);
});

test("atomic private metadata replaces a planted file link without writing its target", posix, () => {
  const root = ensurePrivateDirectory(path.join(directory, "metadata"));
  const victim = path.join(directory, "victim.txt");
  const marker = path.join(root, "sentinel.json");
  fs.writeFileSync(victim, "unchanged");
  fs.symlinkSync(victim, marker);
  writePrivateFileSync(marker, "private marker");
  assert.equal(fs.readFileSync(victim, "utf8"), "unchanged");
  assert.equal(fs.lstatSync(marker).isSymbolicLink(), false);
  assert.equal(mode(marker), 0o600);
});

test("config writes keep locks, primary, backup and recovery private", posix, () => {
  const previous = process.umask(0o022);
  const config = path.join(directory, "configuration", "userConfig.json");
  try {
    updateUserConfigFile(config, () => {
      assert.equal(mode(config + ".lock"), 0o600);
      return { token: "first" };
    });
    updateUserConfigFile(config, (old) => ({ ...old, token: "second" }));
    assert.equal(mode(path.dirname(config)), 0o700);
    assert.equal(mode(config), 0o600);
    assert.equal(mode(config + ".bak"), 0o600);
    assert.equal(JSON.parse(fs.readFileSync(config + ".bak", "utf8")).token, "first");
    fs.writeFileSync(config, "broken JSON");
    assert.equal(readUserConfigFile(config).token, "first");
    updateUserConfigFile(config, (old) => ({ ...old, restored: true }));
    assert.deepEqual(readUserConfigFile(config), { token: "first", restored: true });
    assert.equal(fs.existsSync(config + ".lock"), false);
    assert.deepEqual(fs.readdirSync(path.dirname(config)).sort(), ["userConfig.json", "userConfig.json.bak"]);
  } finally { process.umask(previous); }
});

test("invalid primary config recovers its backup without overwriting it", () => {
  for (const [name, content] of [["empty", ""], ["whitespace", " \n\t"], ["malformed", "{"]]) {
    const config = path.join(directory, name, "userConfig.json");
    fs.mkdirSync(path.dirname(config));
    fs.writeFileSync(config, content);
    const backup = JSON.stringify({ model: "saved-model" });
    fs.writeFileSync(config + ".bak", backup);

    assert.deepEqual(readUserConfigFile(config), { model: "saved-model" }, name);
    updateUserConfigFile(config, (old) => ({ ...old, restored: true }));
    assert.deepEqual(readUserConfigFile(config), { model: "saved-model", restored: true }, name);
    assert.equal(fs.readFileSync(config + ".bak", "utf8"), backup, name);
  }
});

test("an explicit empty config remains valid instead of restoring its backup", () => {
  const config = path.join(directory, "explicit-empty", "userConfig.json");
  fs.mkdirSync(path.dirname(config));
  fs.writeFileSync(config, "{}");
  fs.writeFileSync(config + ".bak", JSON.stringify({ model: "old-model" }));

  assert.deepEqual(readUserConfigFile(config), {});
  updateUserConfigFile(config, (old) => ({ ...old, updated: true }));
  assert.deepEqual(readUserConfigFile(config), { updated: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(config + ".bak", "utf8")), {});
});

test("Windows runtime keeps temporary data under the per-user storage root", () => {
  const savedPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const savedEnv = { ...process.env };
  const originalLoad = Module._load;
  const userData = path.join(directory, "windows-user-data");
  const sharedTemp = path.join(directory, "windows-shared-temp");
  const appData = path.join(directory, "windows-app-data");
  const modulePath = require.resolve("../app_dist/utils/constants");
  const app = {
    isPackaged: true, getAppPath: () => path.join(directory, "application"),
    getPath: (name) => name === "userData" ? userData : sharedTemp,
    setPath() {}, commandLine: { appendSwitch() {} },
  };
  try {
    Object.defineProperty(process, "platform", { value: "win32" });
    Object.assign(process.env, { APPDATA: appData, LOCALAPPDATA: appData, TMPDIR: sharedTemp });
    Module._load = function (name, ...args) { return name === "electron" ? { app } : originalLoad.call(this, name, ...args); };
    delete require.cache[modulePath];
    const paths = require(modulePath).initializeAppPaths();
    assert.equal(paths.userDataDir, fs.realpathSync(userData));
    assert.equal(paths.tempDir, path.join(paths.userDataDir, "temp"));
    assert.equal(paths.cacheDir, path.join(paths.userDataDir, "Cache"));
  } finally {
    Module._load = originalLoad;
    Object.defineProperty(process, "platform", savedPlatform);
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    delete require.cache[modulePath];
  }
});
