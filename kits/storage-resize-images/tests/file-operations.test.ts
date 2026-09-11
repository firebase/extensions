/**
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

/**
 * Covers the path-traversal guard the extension exercises in
 * `__tests__/vulnerability.test.ts`. That suite drives a real project through
 * `gcloud` and the Firebase Web SDK and is skipped unless
 * RUN_VULNERABILITY_TEST=true; a standalone kit has no such project, so the
 * same two attacks — escaping to the bucket root, and escaping into another
 * user's directory — are asserted against `handleFailedImage` directly.
 */

import * as path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("mkdirp", () => ({ mkdirp: vi.fn().mockResolvedValue(undefined) }));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, unlinkSync: vi.fn() };
});

vi.mock("../src/logs", () => ({
  tempDirectoryCreating: vi.fn(),
  tempDirectoryCreated: vi.fn(),
  imageDownloading: vi.fn(),
  imageDownloaded: vi.fn(),
  tempOriginalFileDeleting: vi.fn(),
  tempOriginalFileDeleted: vi.fn(),
  remoteFileDeleting: vi.fn(),
  remoteFileDeleted: vi.fn(),
  errorDeleting: vi.fn(),
  failedImageUploading: vi.fn(),
  failedImageUploaded: vi.fn(),
  invalidFailedResizePath: vi.fn(),
}));

import * as fs from "node:fs";

import type { ResolvedResizeImagesConfig } from "../src/export-config";
import { resolveResizeImagesConfig } from "../src/export-config";
import {
  deleteRemoteFile,
  deleteTempFile,
  downloadOriginalFile,
  handleFailedImage,
} from "../src/file-operations";
import * as logs from "../src/logs";
import type { StorageObjectMetadata } from "../src/util";

function makeConfig(
  overrides: Partial<ResolvedResizeImagesConfig> = {}
): ResolvedResizeImagesConfig {
  return {
    ...resolveResizeImagesConfig({
      bucket: "extensions-testing.appspot.com",
      sizes: "200x200",
      region: "us-central1",
    }),
    ...overrides,
  };
}

function makeBucket() {
  const download = vi.fn().mockResolvedValue(undefined);
  const remoteFile = { download, delete: vi.fn().mockResolvedValue(undefined) };
  const bucket = {
    file: vi.fn(() => remoteFile),
    upload: vi.fn().mockResolvedValue([{}]),
  };
  return { bucket, remoteFile };
}

function objectAt(name: string): StorageObjectMetadata {
  return {
    bucket: "extensions-testing.appspot.com",
    name,
    contentType: "image/png",
  };
}

describe("handleFailedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does nothing when no failedImagesPath is configured", async () => {
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      false,
      makeConfig({ failedImagesPath: undefined })
    );

    expect(bucket.upload).not.toHaveBeenCalled();
  });

  // The containment check compares a `path.join` result against a
  // forward-slash object prefix, so on Windows every destination is rejected
  // as escaping. Cloud Functions run on Linux; these assert the Linux path.
  const posixOnly = test.runIf(path.sep === "/");

  posixOnly("uploads the original beside it, marked as failed", async () => {
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      false,
      makeConfig({ failedImagesPath: "failed" })
    );

    expect(bucket.upload).toHaveBeenCalledWith("/tmp/local.png", {
      destination: path.join("users/abc/images", "failed", "photo.png"),
      metadata: { metadata: { resizeFailed: "true" } },
    });
  });

  posixOnly("flags content-filter failures in the metadata", async () => {
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      true,
      makeConfig({ failedImagesPath: "failed" })
    );

    expect(bucket.upload).toHaveBeenCalledWith(
      "/tmp/local.png",
      expect.objectContaining({
        metadata: {
          metadata: { resizeFailed: "true", contentFilterFailed: "true" },
        },
      })
    );
  });

  test("refuses a failedImagesPath containing a negative traversal", async () => {
    // Attack 1 from the extension's vulnerability suite: a failed image
    // escaping to the bucket root, where it could overwrite `config.json`.
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      false,
      makeConfig({ failedImagesPath: "/../../../" })
    );

    expect(bucket.upload).not.toHaveBeenCalled();
    expect(logs.invalidFailedResizePath).toHaveBeenCalled();
  });

  test("refuses a destination that normalizes outside the original's directory", async () => {
    // Attack 2: escaping sideways into another user's directory.
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      false,
      makeConfig({ failedImagesPath: ".." })
    );

    expect(bucket.upload).not.toHaveBeenCalled();
    expect(logs.invalidFailedResizePath).toHaveBeenCalled();
  });

  test("refuses a nested sideways escape into another user's directory", async () => {
    const { bucket } = makeBucket();
    const name = "users/abc/images/photo.png";

    await handleFailedImage(
      bucket as never,
      "/tmp/local.png",
      objectAt(name),
      path.parse(name),
      false,
      makeConfig({ failedImagesPath: "sub/../../../xyz" })
    );

    expect(bucket.upload).not.toHaveBeenCalled();
    expect(logs.invalidFailedResizePath).toHaveBeenCalled();
  });

  posixOnly(
    "keeps an absolute-looking failedImagesPath inside the original's directory",
    async () => {
      // `path.join` does not treat a leading "/" as a reset, so this lands
      // under the original's directory rather than at the bucket root.
      const { bucket } = makeBucket();
      const name = "users/abc/images/photo.png";

      await handleFailedImage(
        bucket as never,
        "/tmp/local.png",
        objectAt(name),
        path.parse(name),
        false,
        makeConfig({ failedImagesPath: "/failed" })
      );

      expect(bucket.upload).toHaveBeenCalledWith(
        "/tmp/local.png",
        expect.objectContaining({
          destination: "users/abc/images/failed/photo.png",
        })
      );
    }
  );
});

describe("downloadOriginalFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("downloads to a temp path and returns the remote handle", async () => {
    const { bucket, remoteFile } = makeBucket();

    const [localFile, returnedFile] = await downloadOriginalFile(
      bucket as never,
      "images/photo.png",
      true
    );

    expect(bucket.file).toHaveBeenCalledWith("images/photo.png");
    expect(returnedFile).toBe(remoteFile);
    expect(remoteFile.download).toHaveBeenCalledWith({
      destination: localFile,
    });
    // A uuid under the OS temp dir — never the object's own path, which a
    // crafted object name could otherwise steer.
    expect(path.dirname(localFile)).not.toContain("images");
    expect(path.basename(localFile)).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("stays silent when not verbose", async () => {
    const { bucket } = makeBucket();

    await downloadOriginalFile(bucket as never, "images/photo.png", false);

    expect(logs.imageDownloading).not.toHaveBeenCalled();
    expect(logs.tempDirectoryCreating).not.toHaveBeenCalled();
  });
});

describe("deleteTempFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("unlinks the local file", async () => {
    await deleteTempFile("/tmp/local.png", "images/photo.png", true);
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/local.png");
  });

  test("swallows an unlink failure", async () => {
    (
      fs.unlinkSync as unknown as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    await expect(
      deleteTempFile("/tmp/missing.png", "images/photo.png", false)
    ).resolves.toBeUndefined();
    expect(logs.errorDeleting).toHaveBeenCalled();
  });
});

describe("deleteRemoteFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the object", async () => {
    const { remoteFile } = makeBucket();

    await deleteRemoteFile(remoteFile as never, "images/photo.png");

    expect(remoteFile.delete).toHaveBeenCalledTimes(1);
    expect(logs.remoteFileDeleted).toHaveBeenCalledWith("images/photo.png");
  });

  test("swallows a delete failure", async () => {
    const { remoteFile } = makeBucket();
    remoteFile.delete.mockRejectedValue(new Error("403"));

    await expect(
      deleteRemoteFile(remoteFile as never, "images/photo.png")
    ).resolves.toBeUndefined();
    expect(logs.errorDeleting).toHaveBeenCalled();
  });
});
