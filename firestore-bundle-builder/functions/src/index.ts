/**
 * This extension sets up a http-serving Cloud Function.
 *
 * The function reads all bundle specifications under a configured Firestore
 * collection, and serves requests for bundle files specified by the
 * specifications.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Timestamp } from "@google-cloud/firestore";
import { BundleSpec, build, ParamsSpec } from "./build_bundle";
import { Storage } from "@google-cloud/storage";
import { createGzip } from "zlib";
const { Readable } = require("stream");

const BUNDLESPEC_COLLECTION = process.env.BUNDLESPEC_COLLECTION || "bundles";
const BUNDLE_STORAGE_BUCKET =
  process.env.BUNDLE_STORAGE_BUCKET || "bundle-builder-files";
const STORAGE_PREFIX = process.env.STORAGE_PREFIX || "bundles";

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

const bucket = new Storage().bucket(BUNDLE_STORAGE_BUCKET);

const _waits: (() => void)[] = [];
// Cached Bundle specifications, read from Firestore.
const _specs: { [name: string]: BundleSpec } = {};
let _specsReady = false;

function specsReady() {
  _specsReady = true;
  while (_waits && _waits.length > 0) {
    // tslint:disable-next-line:no-empty
    (_waits.pop() || (() => {}))();
  }
}

// Returns a BundleSpec for the given bundle ID/name.
function spec(name: string): Promise<BundleSpec | null> {
  if (_specsReady) {
    return Promise.resolve(_specs[name] || null);
  }

  return new Promise((resolve) => {
    _waits.push(() => {
      resolve(_specs[name] || null);
    });
  });
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
    arr.push([k, qs[k].toString()].join("="));
  }
  return arr.sort().join("&");
}

// Returns a path for the given bundle Id and associated http query parameters.
function storagePath(bundleId: string, query: { [k: string]: any }): string {
  return `${STORAGE_PREFIX}/${bundleId}?${sortQuery(query)}`;
}

/**
 * Returns a `ReadableStream` if a valid GCS file can be found for the given
 * bundle ID and query parameters.
 *
 * Returns null if the file and out-of-date or if an error occurs.
 */
async function fileCacheStream(
  bundleId: string,
  query: { [k: string]: any },
  options: {
    ttlSec: number;
    gzip?: boolean;
  }
): Promise<NodeJS.ReadableStream | null> {
  const file = bucket.file(storagePath(bundleId, query));
  try {
    // keep gzip compression for over the wire
    return file.createReadStream({ decompress: !options.gzip });
  } catch (e) {
    functions.logger.error("createReadStream error:", e.message, e.code);
    return null;
  }
}

// Starts listening to the bundle specification collection, and update in memory cache when there
// are new snapshots.
db.collection(BUNDLESPEC_COLLECTION).onSnapshot((snap) => {
  snap.docs.forEach((doc) => {
    _specs[doc.id] = doc.data();
  });
  specsReady();
});

/**
 * Cloud Function to serve bundle building http requests.
 *
 * The last path segment of the http request will be the bundle ID to look for, and the
 * request query parameters will be the values to use to parameterize the bundle
 * specification.
 *
 * If the bundle specification has `fileCache` == true, it would first check if
 * there is a valid bundle file saved in GCS, and return that if yes. It would
 * save the built bundle file GCS, if a valid bundle file could not be found.
 */
export const serve = functions.handler.https.onRequest(
  async (req, res): Promise<any> => {
    functions.logger.debug(
      "accept-encoding:",
      req.get("accept-encoding"),
      req.headers
    );
    const canGzip = req.get("accept-encoding")?.includes("gzip") || false;
    if (canGzip) {
      res.set("content-encoding", "gzip");
    }
    functions.logger.debug("canGzip:", canGzip);

    const parts = req.path.split("/");
    const bundleId = parts[parts.length - 1];
    const bundleSpec = await spec(bundleId);

    functions.logger.debug("spec:", bundleSpec);

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
    if (bundleSpec.fileCache) {
      functions.logger.debug("handling fileCache", bundleSpec.fileCache);

      const outStream = await fileCacheStream(bundleId, paramValues, {
        ttlSec: bundleSpec.fileCache,
        gzip: canGzip,
      });

      if (outStream) {
        functions.logger.debug("fileCache HIT");
        return outStream.pipe(res);
      }
    }

    const gzip = createGzip({ level: 9 });

    try {
      let stream = Readable.from(
        (await build(db, bundleId, bundleSpec, paramValues)).build()
      );

      if (canGzip) {
        stream = stream.pipe(gzip);
      }

      if (bundleSpec.fileCache) {
        functions.logger.debug("streaming to GCS...");
        let storageStream = stream;
        if (!canGzip) {
          storageStream = stream.pipe(gzip);
        }
        storageStream.pipe(
          bucket
            .file(storagePath(bundleId, paramValues))
            .createWriteStream({ metadata: { contentEncoding: "gzip" } })
        );
      }

      return stream.pipe(res);
    } catch (e) {
      functions.logger.error(e);
      res.status(500).send(e.message);
    }
  }
);
