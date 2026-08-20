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
 * Live integration tests for checkImageContent — these hit the real
 * Vertex AI Gemini 2.5 Flash API. They are skipped by default and only
 * run when RUN_LIVE_CONTENT_FILTER_TESTS=true.
 *
 * Run locally:
 *   gcloud auth application-default login
 *   GCLOUD_PROJECT=<your-project> RUN_LIVE_CONTENT_FILTER_TESTS=true \
 *     npm test -- tests/integration/content-filter.live.test.ts
 *
 * The Bug 1 regression test additionally requires LIVE_BORDERLINE_IMAGE_PATH
 * pointing to a borderline-NSFW image that triggers Gemini's input-side
 * safety refusal. That image cannot be checked into a public repo, so
 * developers/CI supply their own. Without the env var, that test is
 * skipped (the suite still runs the safe-image and weapon-image cases).
 */

import * as path from "node:path";

import { describe, expect, test } from "vitest";

import { checkImageContent } from "../../src/content-filter";

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

const runLive = process.env.RUN_LIVE_CONTENT_FILTER_TESTS === "true";
const describeLive = runLive ? describe : describe.skip;

// The kit requires an explicit region — it has no "us-central1" fallback.
const LOCATION = process.env.FUNCTION_REGION ?? "us-central1";

describeLive(
  "checkImageContent (live, hits Vertex AI Gemini 2.5 Flash)",
  () => {
    // test-jpg.jpg is the word "test" rendered as text — has actual content
    // for Gemini to evaluate. test-image.png is a tiny black square which
    // can trip BLOCK_LOW_AND_ABOVE simply because the model has nothing
    // to be confident about.
    const fixture = (name: string) =>
      path.join(__dirname, "..", "fixtures", name);
    const safeImagePath = fixture("test-jpg.jpg");
    const weaponImagePath = fixture("gun-image.png");

    const weaponPrompt =
      "Does this image contain a weapon (e.g. firearm, knife, explosive)? " +
      "Answer 'yes' if it does, otherwise 'no'.";

    // First-call cold start can be 20s+.
    test("safe everyday image passes with BLOCK_ONLY_HIGH", async () => {
      // BLOCK_ONLY_HIGH is the most permissive non-disabled threshold;
      // BLOCK_LOW_AND_ABOVE can over-trigger on synthetic test fixtures
      // (the no-prompt path uses 1-output-token, so the model has very
      // little room to indicate "this is fine").
      const result = await checkImageContent(
        safeImagePath,
        "BLOCK_ONLY_HIGH",
        null,
        "image/jpeg",
        LOCATION
      );
      expect(result).toBe(true);
    }, 60_000);

    test("weapon image + weapon-detection custom prompt is blocked", async () => {
      const result = await checkImageContent(
        weaponImagePath,
        "BLOCK_LOW_AND_ABOVE",
        weaponPrompt,
        "image/png",
        LOCATION
      );
      expect(result).toBe(false);
    }, 60_000);

    test("safe image + weapon-detection custom prompt is NOT blocked", async () => {
      // Guards against the model over-triggering on unrelated content.
      const result = await checkImageContent(
        safeImagePath,
        "BLOCK_LOW_AND_ABOVE",
        weaponPrompt,
        "image/jpeg",
        LOCATION
      );
      expect(result).toBe(true);
    }, 60_000);

    const borderlinePath = process.env.LIVE_BORDERLINE_IMAGE_PATH;
    const borderlineDescribe = borderlinePath ? describe : describe.skip;
    const borderlineContentType = borderlinePath
      ? guessContentType(borderlinePath)
      : "application/octet-stream";

    borderlineDescribe(
      "Bug 1 regression — borderline image (LIVE_BORDERLINE_IMAGE_PATH set)",
      () => {
        const moderationPrompt =
          "You are classifying images for a family-friendly platform. " +
          "Decide whether this image depicts intimate, romantic, or " +
          "suggestive content. Answer 'yes' if any is present, otherwise 'no'.";

        test("borderline image refused by Gemini safety returns false (not thrown)", async () => {
          // Without the fix, Gemini returns null content → genkit throws
          // ValidationError → 3 retries → propagates as filterErrored.
          // With the fix, the null-content shape is recognised as a block.
          const result = await checkImageContent(
            borderlinePath as string,
            "BLOCK_LOW_AND_ABOVE",
            moderationPrompt,
            borderlineContentType,
            LOCATION
          );
          expect(result).toBe(false);
        }, 60_000);

        test("same image with BLOCK_NONE still passes (threshold is honoured)", async () => {
          const result = await checkImageContent(
            borderlinePath as string,
            "BLOCK_NONE",
            null,
            borderlineContentType,
            LOCATION
          );
          expect(result).toBe(true);
        }, 60_000);
      }
    );
  }
);
