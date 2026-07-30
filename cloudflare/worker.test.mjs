import assert from "node:assert/strict";
import test from "node:test";
import worker, { resolveObjectKey } from "./worker.mjs";

class MockObject {
  constructor(bytes, range) {
    this.allBytes = bytes;
    this.size = bytes.length;
    this.httpEtag = '"test-etag"';
    this.range = range;
    const selected =
      range === undefined
        ? bytes
        : bytes.slice(range.offset, range.offset + range.length);
    this.body = selected;
  }

  writeHttpMetadata(headers) {
    headers.set("content-type", "application/octet-stream");
  }
}

class MockBucket {
  constructor(objects) {
    this.objects = objects;
  }

  async head(key) {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : new MockObject(bytes);
  }

  async get(key, options) {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : new MockObject(bytes, options?.range);
  }
}

const env = {
  APK_BUCKET: new MockBucket(
    new Map([
      ["manifest.json", new TextEncoder().encode('{"version":2}')],
      ["apk/demo.apk", new Uint8Array([0, 1, 2, 3, 4, 5])],
    ]),
  ),
};

test("only exposes fixed manifest/helper and flat APK/ZIP paths", () => {
  assert.equal(resolveObjectKey("/manifest.json"), "manifest.json");
  assert.equal(resolveObjectKey("/remote-preinstall.jar"), "remote-preinstall.jar");
  assert.equal(resolveObjectKey("/apk/demo.apk"), "apk/demo.apk");
  assert.equal(resolveObjectKey("/apk/splits.zip"), "apk/splits.zip");
  assert.equal(resolveObjectKey("/apk/../secret.apk"), null);
  assert.equal(resolveObjectKey("/apk/%2e%2e%2fsecret.apk"), null);
  assert.equal(resolveObjectKey("/apk/sub/demo.apk"), null);
  assert.equal(resolveObjectKey("/other.txt"), null);
});

test("serves manifest without persistent caching", async () => {
  const response = await worker.fetch(
    new Request("https://apk.daivietpda.com/manifest.json"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
  assert.equal(await response.text(), '{"version":2}');
});

test("supports a single byte range for APK downloads", async () => {
  const response = await worker.fetch(
    new Request("https://apk.daivietpda.com/apk/demo.apk", {
      headers: { range: "bytes=2-4" },
    }),
    env,
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-4/6");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([2, 3, 4]));
});

test("rejects unsupported methods and invalid ranges", async () => {
  const post = await worker.fetch(
    new Request("https://apk.daivietpda.com/manifest.json", { method: "POST" }),
    env,
  );
  assert.equal(post.status, 405);

  const range = await worker.fetch(
    new Request("https://apk.daivietpda.com/apk/demo.apk", {
      headers: { range: "bytes=20-30" },
    }),
    env,
  );
  assert.equal(range.status, 416);
});
