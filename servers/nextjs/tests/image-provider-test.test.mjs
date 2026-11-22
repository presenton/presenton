import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let ImagesApi;
let temporaryDirectory;
const originalFetch = globalThis.fetch;

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "presenton-image-test-"));
  const outfile = path.join(temporaryDirectory, "images.mjs");
  await build({
    entryPoints: [path.resolve("app/(presentation-generator)/services/api/images.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  ({ ImagesApi } = await import(pathToFileURL(outfile).href));
});

test.afterEach(() => { globalThis.fetch = originalFetch; });
test.after(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

test("tests draft configuration in the POST body and forwards cancellation", async () => {
  const config = { IMAGE_PROVIDER: "gpt-image-2", OPENAI_API_KEY: "draft-key" };
  const { signal } = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/ppt/images/test");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), config);
    assert.equal(options.signal, signal);
    return Response.json({ image_url: "data:image/png;base64,c2FtcGxl" });
  };
  assert.deepEqual(await ImagesApi.testProvider(config, signal), {
    image_url: "data:image/png;base64,c2FtcGxl",
  });
});

test("preserves provider failure detail for inline feedback", async () => {
  globalThis.fetch = async () => Response.json({ detail: "Provider quota exhausted" }, { status: 429 });
  await assert.rejects(ImagesApi.testProvider({ IMAGE_PROVIDER: "gpt-image-2" }), /Provider quota exhausted/);
});

test("rejects a successful response that contains no image", async () => {
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(ImagesApi.testProvider({ IMAGE_PROVIDER: "gpt-image-2" }), /did not return a sample image/);
});

test("preserves request aborts so stale tests cannot update the form", async () => {
  globalThis.fetch = async () => { throw new DOMException("Aborted", "AbortError"); };
  await assert.rejects(ImagesApi.testProvider({ IMAGE_PROVIDER: "gpt-image-2" }), { name: "AbortError" });
});


for (const model of ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]) {
  test(`forwards ${model} and its quality to the image test endpoint`, async () => {
    const config = { IMAGE_PROVIDER: model, OPENAI_API_KEY: "draft-key", GPT_IMAGE_2_5_QUALITY: "max" };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/v1/ppt/images/test");
      assert.deepEqual(JSON.parse(options.body), config);
      return Response.json({ image_url: "data:image/png;base64,c2FtcGxl" });
    };
    assert.equal((await ImagesApi.testProvider(config)).image_url, "data:image/png;base64,c2FtcGxl");
  });
}
