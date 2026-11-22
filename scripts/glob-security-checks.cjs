const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

exports.registerGlobSecurityTests = ({ modernMatcherPath, modernGlobPath, legacyMatcherPath }) => {
  test("modern glob preprocessing honors its expansion budget", () => {
    const probe = spawnSync(process.execPath, ["--max-old-space-size=128", "-e", `
      const assert = require('node:assert/strict');
      const { Minimatch, minimatch } = require(${JSON.stringify(modernMatcherPath)});
      for (const pattern of ['**/../'.repeat(50) + '*.ts', 'a/**/../'.repeat(50) + '*.ts']) {
        const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
        assert.ok(matcher.set.length <= 64);
      }
      assert.equal(minimatch('slides/deck.ts', '**/*.{ts,tsx}', { optimizationLevel: 2 }), true);
      assert.equal(minimatch('slides/deck.txt', '**/*.{ts,tsx}', { optimizationLevel: 2 }), false);
    `], { encoding: "utf8", timeout: 5000 });
    assert.equal(probe.status, 0, String(probe.error || probe.stderr));
  });

  test("glob cancellation stops directory traversal and preserves ordinary discovery", async () => {
    const { glob } = require(modernGlobPath);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-glob-security-"));
    try {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const dir = path.join(root, String(i), String(j));
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "deck.ts"), "control");
        }
      }
      const controller = new AbortController();
      let reads = 0;
      const monitoredFs = {
        ...fs,
        readdir(...args) {
          reads++;
          fs.readdir(...args);
          if (reads === 1) controller.abort(new Error("security-probe-abort"));
        },
      };
      await assert.rejects(glob("**/*", {
        cwd: root, fs: monitoredFs, signal: controller.signal,
      }), /security-probe-abort/);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(reads, 1, "an aborted walk must not read additional directories");
      const alreadyAborted = AbortSignal.abort(new Error("already-aborted"));
      await assert.rejects(glob("**/*", { cwd: root, fs: monitoredFs, signal: alreadyAborted }), /already-aborted/);
      assert.equal(reads, 1);
      assert.equal((await glob("**/*.{ts,tsx}", { cwd: root })).length, 25);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("legacy glob consumers keep their callable matcher without the affected optimizer", () => {
    const minimatch = require(legacyMatcherPath);
    assert.equal(typeof minimatch, "function");
    assert.equal(minimatch.Minimatch.prototype.firstPhasePreProcess, undefined);
    assert.equal(minimatch("slides/deck.ts", "**/*.{ts,tsx}"), true);
    assert.equal(minimatch("slides/deck.txt", "**/*.{ts,tsx}"), false);
  });
};
