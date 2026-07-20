import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(repoRoot, ".vscode", "mcp.json");

test("workspace Presenton MCP configuration prompts for its API key", async () => {
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw);
  const server = config.servers?.presentonmcp;
  const apiKeyInput = config.inputs?.find(
    (input) => input?.id === "presenton-api-key",
  );

  assert.ok(server);
  assert.equal(server.type, "http");
  assert.equal(server.url, "https://api.presenton.ai/mcp");
  assert.equal(
    server.headers?.Authorization,
    "Bearer ${input:presenton-api-key}",
  );
  assert.deepEqual(apiKeyInput, {
    type: "promptString",
    id: "presenton-api-key",
    description: "Presenton MCP API key",
    password: true,
  });
  assert.doesNotMatch(raw, /sk-presenton-/);
});
