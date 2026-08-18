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

import * as path from "node:path";
import * as admin from "firebase-admin";
import { beforeAll, describe, expect, test } from "vitest";

process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.STORAGE_EMULATOR_HOST = "http://127.0.0.1:9199";
process.env.GOOGLE_CLOUD_PROJECT = "demo-test";

const BUCKET = "demo-test.appspot.com";
const RESIZED_PATH = "thumbs";
const FAILED_PATH = "failed";
const SIZE = "200x200";

let storage: admin.storage.Storage;

const fixture = (name: string) => path.join(__dirname, "..", name);

/** Polls until the trigger has written the file, or gives up. */
async function waitForFile(
  filePath: string,
  timeout = 30_000
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const [exists] = await storage.bucket(BUCKET).file(filePath).exists();
    if (exists) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

describe("generateResizedImage in the emulator", () => {
  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: "demo-test", storageBucket: BUCKET });
    }
    storage = admin.storage();

    const bucket = storage.bucket(BUCKET);
    await bucket.upload(fixture("test-image.jpeg"), {
      destination: "test-image.jpeg",
      metadata: { contentType: "image/jpeg" },
    });
    await bucket.upload(fixture("not-an-image.jpeg"), {
      destination: "not-an-image.jpeg",
      metadata: { contentType: "image/jpeg" },
    });
    await bucket.upload(fixture("test-img.jfif"), {
      destination: "test-img.jfif",
      metadata: { contentType: "image/jpeg" },
    });
  });

  test("resizes test-image.jpeg", async () => {
    expect(await waitForFile(`${RESIZED_PATH}/test-image_${SIZE}.jpeg`)).toBe(
      true
    );
  });

  test("copies a file that is not an image to the failed directory", async () => {
    expect(await waitForFile(`${FAILED_PATH}/not-an-image.jpeg`)).toBe(true);
  });

  test("resizes test-img.jfif", async () => {
    expect(await waitForFile(`${RESIZED_PATH}/test-img_${SIZE}.jfif`)).toBe(
      true
    );
  });

  test("resizes an image uploaded with a jpg content type", async () => {
    await storage.bucket(BUCKET).upload(fixture("test-jpg.jpg"), {
      destination: "test-jpg.jpg",
      metadata: { contentType: "image/jpg" },
    });

    expect(await waitForFile(`${RESIZED_PATH}/test-jpg_${SIZE}.jpg`)).toBe(
      true
    );
  });
});
