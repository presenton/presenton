const assert = require("node:assert/strict");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");

function loadUtils() {
  const app = {
    isPackaged: false,
    getAppPath: () => path.join(os.tmpdir(), "presenton-find-unused-ports"),
  };
  const originalLoad = Module._load;
  Module._load = function (name, ...args) { return name === "electron" ? { app } : originalLoad.call(this, name, ...args); };
  try { return require("../app_dist/utils"); }
  finally { Module._load = originalLoad; }
}

function listen(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

const close = (server) => new Promise((resolve) => server.close(resolve));

async function occupyLoopbackPort(port = 40000) {
  for (;; port += 1) {
    try { return await listen(port, "127.0.0.1"); } catch { /* Port is taken; try the next one. */ }
  }
}

test("ports already bound on the loopback address are not reported as unused", async () => {
  const { findUnusedPorts } = loadUtils();
  // Another local service owns this loopback port, as the app servers would.
  const occupant = await occupyLoopbackPort();
  const occupiedPort = occupant.address().port;
  try {
    const ports = await findUnusedPorts(occupiedPort, 2);
    assert.equal(ports.length, 2);
    assert.ok(!ports.includes(occupiedPort), `port ${occupiedPort} is in use on 127.0.0.1`);
    for (const port of ports) await close(await listen(port, "127.0.0.1"));
  } finally {
    await close(occupant);
  }
});
