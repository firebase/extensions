/**
 * Live integration tests for checkImageContent — these hit the real
 * Vertex AI Gemini 2.5 Flash API. They are skipped by default and only
 * run when RUN_LIVE_CONTENT_FILTER_TESTS=true.
 *
 * Run locally:
 *   gcloud auth application-default login
 *   GCLOUD_PROJECT=<your-project> \
 *     npm run test:live-content-filter --prefix storage-resize-images/functions
 *
 * The Bug 1 regression test additionally requires LIVE_BORDERLINE_IMAGE_PATH
 * pointing to a borderline-NSFW image that triggers Gemini's input-side
 * safety refusal. That image cannot be checked into a public repo, so
 * developers/CI supply their own. Without the env var, that test is
 * skipped (the suite still runs the safe-image and weapon-image cases).
 */

import * as path from "path";
import { checkImageContent } from "../../src/content-filter";

const runLive = process.env.RUN_LIVE_CONTENT_FILTER_TESTS === "true";
const describeLive = runLive ? describe : describe.skip;

describeLive(
  "checkImageContent (live, hits Vertex AI Gemini 2.5 Flash)",
  () => {
    jest.setTimeout(60_000); // first-call cold start can be 20s+

    // test-jpg.jpg is the word "test" rendered as text — has actual content
    // for Gemini to evaluate. test-image.png is a tiny black square which
    // can trip BLOCK_LOW_AND_ABOVE simply because the model has nothing
    // to be confident about.
    const safeImagePath = path.join(__dirname, "..", "test-jpg.jpg");
    const weaponImagePath = path.join(__dirname, "..", "gun-image.png");

    const weaponPrompt =
      "Does this image contain a weapon (e.g. firearm, knife, explosive)? " +
      "Answer 'yes' if it does, otherwise 'no'.";

    test("safe everyday image passes with BLOCK_ONLY_HIGH", async () => {
      // BLOCK_ONLY_HIGH is the most permissive non-disabled threshold;
      // BLOCK_LOW_AND_ABOVE can over-trigger on synthetic test fixtures
      // (the no-prompt path uses 1-output-token, so the model has very
      // little room to indicate "this is fine").
      const result = await checkImageContent(
        safeImagePath,
        "BLOCK_ONLY_HIGH",
        null,
        "image/jpeg"
      );
      expect(result).toBe(true);
    });

    test("weapon image + weapon-detection custom prompt is blocked", async () => {
      const result = await checkImageContent(
        weaponImagePath,
        "BLOCK_LOW_AND_ABOVE",
        weaponPrompt,
        "image/png"
      );
      expect(result).toBe(false);
    });

    test("safe image + weapon-detection custom prompt is NOT blocked", async () => {
      // Guards against the model over-triggering on unrelated content.
      const result = await checkImageContent(
        safeImagePath,
        "BLOCK_LOW_AND_ABOVE",
        weaponPrompt,
        "image/jpeg"
      );
      expect(result).toBe(true);
    });

    const borderlinePath = process.env.LIVE_BORDERLINE_IMAGE_PATH;
    const borderlineDescribe = borderlinePath ? describe : describe.skip;

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
            "image/jpeg"
          );
          expect(result).toBe(false);
        });

        test("same image with BLOCK_NONE still passes (threshold is honoured)", async () => {
          const result = await checkImageContent(
            borderlinePath as string,
            "BLOCK_NONE",
            null,
            "image/jpeg"
          );
          expect(result).toBe(true);
        });
      }
    );
  }
);
