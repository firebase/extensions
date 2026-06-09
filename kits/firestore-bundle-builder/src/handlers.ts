/*
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Readable } from "node:stream";
import { createGzip } from "node:zlib";
import type { Firestore } from "@google-cloud/firestore";
import type { Request } from "firebase-functions/https";
import { type BundleSpec, build, type ParamsSpec } from "./build-bundle";
import type { ResolvedBundleBuilderConfig } from "./export-config";

/**
 * Minimal HTTP response surface the serve handler depends on — the subset of
 * `express.Response` actually used. Typing it structurally keeps the handler
 * free of an explicit `express` dependency while remaining compatible with the
 * response object `onRequest` passes in.
 */
export interface ServeResponse extends NodeJS.WritableStream {
  set(name: string, value: string): unknown;
  status(code: number): ServeResponse;
  send(body: string): unknown;
}

/**
 * Minimal Cloud Storage bucket surface the serve handler depends on. Supplying
 * an interface (rather than the concrete `@google-cloud/storage` Bucket) keeps
 * the handler unit-testable and lets the factory pass `null` to disable caching.
 */
export interface CacheBucket {
  file(path: string): CacheFile;
}

export interface CacheFile {
  createReadStream(options: { decompress?: boolean }): NodeJS.ReadableStream;
  createWriteStream(options: {
    metadata: { contentEncoding: string };
  }): NodeJS.WritableStream;
  getMetadata(): Promise<[{ updated?: string }, ...unknown[]]>;
}

/** A minimal logger surface matching `firebase-functions` logger methods used. */
export interface HandlerLogger {
  debug: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Everything {@link handleServe} needs to do its work, supplied by the factory
 * so the handler stays free of global state and is unit-testable.
 */
export interface HandlerContext {
  /** Firestore client used to build the bundle. */
  db: Firestore;
  /** Resolved configuration. */
  config: ResolvedBundleBuilderConfig;
  /**
   * Returns the {@link BundleSpec} for the given bundle ID/name, or `null` if no
   * spec exists. Reimplements the legacy spec lookup: a per-request
   * `.doc(bundleId).get()` against the spec collection, replacing the legacy
   * module-load `onSnapshot` in-memory cache (outcome-identical).
   */
  getSpec: (bundleId: string) => Promise<BundleSpec | null>;
  /**
   * Cloud Storage bucket used for the file cache, or `null` when caching is
   * disabled (no bucket configured).
   */
  bucket: CacheBucket | null;
  /** Logger; defaults to the firebase-functions logger in the factory. */
  logger: HandlerLogger;
}

// Return query parameters that are specified in given `ParamsSpec`.
function filterQuery(
  qs: { [key: string]: any },
  params: ParamsSpec
): { [key: string]: any } {
  const out: { [key: string]: any } = {};
  for (const k in qs) {
    if (params[k]) out[k] = qs[k];
  }
  return out;
}

// Joins all query parameters and values, and sort them into one string.
function sortQuery(qs: { [key: string]: any }): string {
  const arr: string[] = [];
  for (const k in qs) {
    arr.push([k, String(qs[k] ?? "")].join("="));
  }
  return arr.sort().join("&");
}

// Returns a path for the given bundle Id and associated http query parameters.
function storagePath(
  storagePrefix: string,
  bundleId: string,
  query: { [k: string]: any }
): string {
  return `${storagePrefix}/${bundleId}?${sortQuery(query)}`;
}

/**
 * Returns a `ReadableStream` if a valid GCS file can be found for the given
 * bundle ID and query parameters.
 *
 * Returns null if the file is out-of-date or if an error occurs.
 */
async function fileCacheStream(
  bucket: CacheBucket,
  storagePrefix: string,
  bundleId: string,
  query: { [k: string]: any },
  options: {
    ttlSec: number;
    gzip?: boolean;
  },
  logger: HandlerLogger
): Promise<NodeJS.ReadableStream | null> {
  const file = bucket.file(storagePath(storagePrefix, bundleId, query));
  try {
    // `createReadStream` does not throw synchronously when the object is
    // missing — it emits an async `'error'` event — so probe with
    // `getMetadata` first to confirm the cached file exists and is fresh.
    const [metadata] = await file.getMetadata();
    const updatedTime = metadata.updated
      ? new Date(metadata.updated).getTime()
      : Number.NaN;
    if (
      Number.isNaN(updatedTime) ||
      Date.now() - updatedTime > options.ttlSec * 1000
    ) {
      logger.debug(`Cache expired for bundle: ${bundleId}`);
      return null;
    }
    // keep gzip compression for over the wire
    return file.createReadStream({ decompress: !options.gzip });
  } catch (e: any) {
    logger.debug(`Cache miss or error for bundle ${bundleId}:`, e.message);
    return null;
  }
}

/**
 * Serves a bundle building http request.
 *
 * The last path segment of the http request is the bundle ID to look for, and
 * the request query parameters are the values used to parameterize the bundle
 * specification.
 *
 * If the bundle specification has `fileCache` set, it first checks whether
 * there is a valid bundle file saved in GCS, and returns that if so. It saves
 * the built bundle file to GCS if a valid bundle file could not be found.
 *
 * @param req - The HTTP request.
 * @param res - The HTTP response.
 * @param ctx - The handler context.
 */
export async function handleServe(
  req: Request,
  res: ServeResponse,
  ctx: HandlerContext
): Promise<any> {
  const { config, logger } = ctx;

  logger.debug("accept-encoding:", req.get("accept-encoding"), req.headers);
  const canGzip = req.get("accept-encoding")?.includes("gzip") || false;
  if (canGzip) {
    res.set("content-encoding", "gzip");
  }
  logger.debug("canGzip:", canGzip);

  const parts = req.path.split("/");
  const bundleId = parts[parts.length - 1];
  const bundleSpec = await ctx.getSpec(bundleId);

  logger.debug("spec:", bundleSpec);

  if (!bundleSpec) {
    res.status(404).send("Could not find bundle with ID " + bundleId);
    return;
  }

  const paramValues = filterQuery(req.query, bundleSpec.params || {});

  // Set proper cache-control.
  if (bundleSpec.serverCache || bundleSpec.clientCache) {
    const maxAgeString = bundleSpec.clientCache
      ? `, max-age=${bundleSpec.clientCache}`
      : "";
    const sMaxAgeString = bundleSpec.serverCache
      ? `, s-maxage=${bundleSpec.serverCache}`
      : "";
    res.set("cache-control", `public${maxAgeString}${sMaxAgeString}`);
  }

  // Check if we can reuse what is in GCS.
  if (bundleSpec.fileCache && ctx.bucket) {
    logger.debug("handling fileCache", bundleSpec.fileCache);

    const outStream = await fileCacheStream(
      ctx.bucket,
      config.storagePrefix,
      bundleId,
      paramValues,
      {
        ttlSec: bundleSpec.fileCache,
        gzip: canGzip,
      },
      logger
    );

    if (outStream) {
      logger.debug("fileCache HIT");
      return outStream.pipe(res);
    }
  }

  const gzip = createGzip({ level: 9 });

  try {
    let stream: NodeJS.ReadableStream = Readable.from(
      (await build(ctx.db, bundleId, bundleSpec, paramValues)).build()
    );

    if (canGzip) {
      stream = stream.pipe(gzip);
    }

    if (bundleSpec.fileCache && ctx.bucket) {
      logger.debug("streaming to GCS...");
      let storageStream = stream;
      if (!canGzip) {
        storageStream = stream.pipe(gzip);
      }
      const gcsStream = ctx.bucket
        .file(storagePath(config.storagePrefix, bundleId, paramValues))
        .createWriteStream({ metadata: { contentEncoding: "gzip" } });
      // A write failure emits an async `'error'` event; without a listener it
      // becomes an uncaught exception that crashes the function. Log and
      // surface it gracefully — the response is still served from `stream`.
      gcsStream.on("error", (err) => {
        logger.error("GCS write stream error:", err);
      });
      storageStream.pipe(gcsStream);
    }

    return stream.pipe(res);
  } catch (e: any) {
    logger.error(e);
    res.status(500).send(e.message);
  }
}
