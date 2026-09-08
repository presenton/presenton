import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let copyTextToClipboard;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "presenton-clipboard-"));
  const entryFile = path.join(temporaryDirectory, "entry.ts");
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await writeFile(
    entryFile,
    `export { copyTextToClipboard } from ${JSON.stringify(
      path.resolve("utils/clipboard.ts"),
    )};`,
  );
  await build({
    entryPoints: [entryFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  ({ copyTextToClipboard } = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  ));
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  };
}

function createFallbackDocument({ succeeds = true } = {}) {
  const state = {
    appended: null,
    command: null,
    removed: false,
    refocused: false,
  };
  const textArea = {
    value: "",
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
    remove() {
      state.removed = true;
    },
  };
  return {
    state,
    document: {
      activeElement: {
        focus() {
          state.refocused = true;
        },
      },
      body: {
        appendChild(element) {
          state.appended = element;
        },
      },
      createElement(tagName) {
        assert.equal(tagName, "textarea");
        return textArea;
      },
      execCommand(command) {
        state.command = command;
        return succeeds;
      },
    },
  };
}

test("uses the Clipboard API when it is available", async () => {
  let copiedText;
  const restoreNavigator = replaceGlobal("navigator", {
    clipboard: {
      async writeText(text) {
        copiedText = text;
      },
    },
  });
  const restoreDocument = replaceGlobal("document", undefined);

  try {
    await copyTextToClipboard("secret-key");
    assert.equal(copiedText, "secret-key");
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("falls back when navigator.clipboard is unavailable", async () => {
  const fallback = createFallbackDocument();
  const restoreNavigator = replaceGlobal("navigator", {});
  const restoreDocument = replaceGlobal("document", fallback.document);

  try {
    await copyTextToClipboard("secret-key");
    assert.equal(fallback.state.appended.value, "secret-key");
    assert.equal(fallback.state.command, "copy");
    assert.equal(fallback.state.removed, true);
    assert.equal(fallback.state.refocused, true);
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("falls back when Clipboard API access is denied", async () => {
  const fallback = createFallbackDocument();
  const restoreNavigator = replaceGlobal("navigator", {
    clipboard: {
      async writeText() {
        throw new Error("Clipboard permission denied");
      },
    },
  });
  const restoreDocument = replaceGlobal("document", fallback.document);

  try {
    await copyTextToClipboard("secret-key");
    assert.equal(fallback.state.command, "copy");
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});

test("reports a failure when neither copy mechanism is available", async () => {
  const restoreNavigator = replaceGlobal("navigator", {});
  const restoreDocument = replaceGlobal("document", undefined);

  try {
    await assert.rejects(
      copyTextToClipboard("secret-key"),
      /Clipboard access is not available/,
    );
  } finally {
    restoreDocument();
    restoreNavigator();
  }
});
