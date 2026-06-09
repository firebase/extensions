import { PassThrough, Readable, Writable } from "node:stream";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BundleSpec } from "../src/build-bundle";
import { resolveConfig } from "../src/export-config";
import {
  type CacheBucket,
  type HandlerContext,
  handleServe,
} from "../src/handlers";

// Mock the bundle assembly so the handler runs without real Firestore.
vi.mock("../src/build-bundle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/build-bundle")>();
  return {
    ...actual,
    build: vi.fn(),
  };
});

import { build } from "../src/build-bundle";

const noopLogger = { debug: vi.fn(), error: vi.fn() };

/** A fake firebase-functions HTTPS Request with only the fields read. */
function fakeReq(
  path: string,
  opts: { acceptEncoding?: string; query?: Record<string, any> } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.acceptEncoding) headers["accept-encoding"] = opts.acceptEncoding;
  return {
    path,
    query: opts.query ?? {},
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  } as any;
}

/** A fake Response capturing status, headers, and piped body. */
function fakeRes() {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (c) => chunks.push(Buffer.from(c)));
  const res = Object.assign(sink, {
    statusCode: 200,
    headers: {} as Record<string, string>,
    sent: undefined as string | undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    send(body: string) {
      res.sent = body;
      return res;
    },
    body: () => Buffer.concat(chunks),
  });
  return res as any;
}

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    db: {} as any,
    config: resolveConfig({
      bundleSpecCollection: "bundles",
      bundleStorageBucket: "my-bucket",
      storagePrefix: "bundles",
    }),
    getSpec: vi.fn().mockResolvedValue(null),
    bucket: null,
    logger: noopLogger,
    ...overrides,
  };
}

/** A fake bundle whose `build()` returns the given payload buffer/string. */
function fakeBundle(payload: string) {
  return { build: () => Buffer.from(payload) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleServe", () => {
  test("404 when no spec exists for the bundle id", async () => {
    const ctx = makeCtx({ getSpec: vi.fn().mockResolvedValue(null) });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/missing"), res, ctx);
    expect(res.statusCode).toBe(404);
    expect(res.sent).toBe("Could not find bundle with ID missing");
  });

  test("sets cache-control from clientCache and serverCache", async () => {
    const spec: BundleSpec = { clientCache: 60, serverCache: 120 };
    (build as any).mockResolvedValue(fakeBundle("BUNDLE"));
    const ctx = makeCtx({ getSpec: vi.fn().mockResolvedValue(spec) });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    await new Promise((r) => res.on("finish", r));
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=60, s-maxage=120"
    );
  });

  test("omits cache-control when neither cache is set", async () => {
    const spec: BundleSpec = {};
    (build as any).mockResolvedValue(fakeBundle("BUNDLE"));
    const ctx = makeCtx({ getSpec: vi.fn().mockResolvedValue(spec) });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    expect(res.headers["cache-control"]).toBeUndefined();
  });

  test("sets gzip content-encoding when the client accepts gzip", async () => {
    const spec: BundleSpec = {};
    (build as any).mockResolvedValue(fakeBundle("BUNDLE"));
    const ctx = makeCtx({ getSpec: vi.fn().mockResolvedValue(spec) });
    const res = fakeRes();
    await handleServe(
      fakeReq("/serve/b1", { acceptEncoding: "gzip" }),
      res,
      ctx
    );
    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  test("cache hit: serves the Storage stream and does not rebuild", async () => {
    const spec: BundleSpec = { fileCache: 300 };
    const cachedStream = Readable.from(Buffer.from("CACHED"));
    const file = {
      createReadStream: vi.fn(() => cachedStream),
      createWriteStream: vi.fn(),
    };
    const bucket: CacheBucket = { file: vi.fn(() => file) };
    const ctx = makeCtx({
      getSpec: vi.fn().mockResolvedValue(spec),
      bucket,
    });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    await new Promise((r) => res.on("finish", r));

    expect(file.createReadStream).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
    expect(res.body().toString()).toBe("CACHED");
  });

  test("cache hit uses the prefix/bundleId/sorted-query storage path", async () => {
    const spec: BundleSpec = {
      fileCache: 300,
      params: { a: { type: "string" }, b: { type: "string" } },
    };
    const file = {
      createReadStream: vi.fn(() => Readable.from(Buffer.from("X"))),
      createWriteStream: vi.fn(),
    };
    const bucket: CacheBucket = { file: vi.fn(() => file) };
    const ctx = makeCtx({
      getSpec: vi.fn().mockResolvedValue(spec),
      bucket,
    });
    const res = fakeRes();
    await handleServe(
      fakeReq("/serve/b1", { query: { b: "2", a: "1", ignored: "z" } }),
      res,
      ctx
    );
    await new Promise((r) => res.on("finish", r));
    // Query is filtered to spec params and sorted: a=1&b=2.
    expect(bucket.file).toHaveBeenCalledWith("bundles/b1?a=1&b=2");
  });

  test("cache miss: builds the bundle and writes it to Storage", async () => {
    const spec: BundleSpec = { fileCache: 300 };
    // Simulate a miss: createReadStream throws synchronously.
    const writes: Buffer[] = [];
    const writeStream = new Writable({
      write(chunk, _enc, cb) {
        writes.push(Buffer.from(chunk));
        cb();
      },
    });
    const file = {
      createReadStream: vi.fn(() => {
        throw Object.assign(new Error("not found"), { code: 404 });
      }),
      createWriteStream: vi.fn(() => writeStream),
    };
    const bucket: CacheBucket = { file: vi.fn(() => file) };
    (build as any).mockResolvedValue(fakeBundle("FRESH"));
    const ctx = makeCtx({
      getSpec: vi.fn().mockResolvedValue(spec),
      bucket,
    });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    await new Promise((r) => res.on("finish", r));

    expect(build).toHaveBeenCalledTimes(1);
    expect(file.createWriteStream).toHaveBeenCalledWith({
      metadata: { contentEncoding: "gzip" },
    });
    expect(res.body().toString()).toBe("FRESH");
  });

  test("no caching when bucket is null even if spec requests fileCache", async () => {
    const spec: BundleSpec = { fileCache: 300 };
    (build as any).mockResolvedValue(fakeBundle("FRESH"));
    const ctx = makeCtx({
      getSpec: vi.fn().mockResolvedValue(spec),
      bucket: null,
    });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    await new Promise((r) => res.on("finish", r));
    expect(build).toHaveBeenCalledTimes(1);
    expect(res.body().toString()).toBe("FRESH");
  });

  test("500 when the build throws", async () => {
    const spec: BundleSpec = {};
    (build as any).mockRejectedValue(new Error("boom"));
    const ctx = makeCtx({ getSpec: vi.fn().mockResolvedValue(spec) });
    const res = fakeRes();
    await handleServe(fakeReq("/serve/b1"), res, ctx);
    expect(res.statusCode).toBe(500);
    expect(res.sent).toBe("boom");
  });
});
