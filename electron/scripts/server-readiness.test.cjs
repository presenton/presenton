const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const Module = require("node:module");
const test = require("node:test");

// Expose the compiled private helper without changing its implementation.
const filename = require.resolve("../app_dist/utils/servers");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
const originalLoad = Module._load;
try {
  Module._load = function (name, parent, ...args) {
    if (parent?.filename === filename) {
      if (name === "./constants") return {};
      if (name === "./index") return {};
    }
    return originalLoad.call(this, name, parent, ...args);
  };
  loaded._compile(fs.readFileSync(filename, "utf8") + "\nexports.waitForServer = waitForServer;", filename);
} finally { Module._load = originalLoad; }
const { waitForServer } = loaded.exports;

async function listen(t, server) {
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}/ready`;
}

test("the total deadline ends a request kept active by partial response headers", async (t) => {
  let closed;
  const peerClosed = new Promise((resolve) => { closed = resolve; });
  const url = await listen(t, net.createServer((socket) => {
    socket.on("error", () => {});
    socket.write("HTTP/1.1 200 OK\r\nX-Progress: ");
    const timer = setInterval(() => socket.write("x"), 20);
    socket.on("close", () => { clearInterval(timer); closed(); });
  }));
  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), 1000);
  t.after(() => clearTimeout(watchdog));
  await assert.rejects(waitForServer(url, 150, controller.signal), /Server did not start within 150ms/);
  await Promise.race([peerClosed, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("expired request was not closed")), 500);
    peerClosed.finally(() => clearTimeout(timer));
  })]);
});

test("retry backoff respects the remaining total budget", async (t) => {
  let requests = 0;
  const url = await listen(t, http.createServer((_, response) => { requests++; response.writeHead(503).end(); }));
  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), 1000);
  t.after(() => clearTimeout(watchdog));
  await assert.rejects(waitForServer(url, 150, controller.signal), /Server did not start within 150ms/);
  assert.equal(requests, 1);
});

test("ordinary readiness responses still succeed", async (t) => {
  for (const status of [200, 404]) {
    await t.test(String(status), async (t) => {
      const url = await listen(t, http.createServer((_, response) => response.writeHead(status).end()));
      await waitForServer(url, 500);
    });
  }
});

test("abort destroys a pending request", async (t) => {
  let requestStarted;
  const started = new Promise((resolve) => { requestStarted = resolve; });
  const url = await listen(t, http.createServer(() => requestStarted()));
  const controller = new AbortController();
  const waiting = waitForServer(url, 2000, controller.signal);
  await started;
  controller.abort();
  await assert.rejects(waiting, /Server wait aborted/);
});

test("retrying an unhealthy server can still become ready", async (t) => {
  let requests = 0;
  const url = await listen(t, http.createServer((_, response) => response.writeHead(++requests === 1 ? 503 : 200).end()));
  await waitForServer(url, 2000);
  assert.equal(requests, 2);
});
