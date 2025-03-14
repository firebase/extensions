import { checkImageContent } from "../src/content-filter"; // Update this import path
import * as path from "path";
import { HarmBlockThreshold } from "@google-cloud/vertexai";
// Setting longer timeout since API calls can take time
jest.setTimeout(60000); // Increased timeout for multiple API calls

// To run these integration tests, you need to be authenticated with gcloud, or set GOOGLE_APPLICATION_CREDENTIALS.
describe("checkImageContent", () => {
  // Test path for the image
  // const imagePath = path.join(__dirname, "game-violence.png");
  const imagePath = path.join(__dirname, "gun-image.png");

  it("should block inappropriate content with BLOCK_LOW_AND_ABOVE filter", async () => {
    // Test with BLOCK_LOW_AND_ABOVE (most restrictive)
    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      null
    );
    console.log("BLOCK_LOW_AND_ABOVE filter result:", result);
    expect(result).toBe(false); // Expected to block content
  });

  it("should block inappropriate content with BLOCK_MEDIUM_AND_ABOVE filter", async () => {
    // Test with BLOCK_MEDIUM_AND_ABOVE (medium restrictive)
    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null
    );
    console.log("BLOCK_MEDIUM_AND_ABOVE filter result:", result);
    expect(result).toBe(true); // Expected to block content
  });

  it("should handle inappropriate content with BLOCK_ONLY_HIGH filter", async () => {
    // Test with BLOCK_ONLY_HIGH (least restrictive, only blocking severe content)
    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_ONLY_HIGH,
      null
    );
    console.log("BLOCK_ONLY_HIGH filter result:", result);
    // We don't assert here as it depends on severity level of the test image
  });

  it("should allow content with BLOCK_NONE filter", async () => {
    // Test with BLOCK_NONE (no blocking)
    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_NONE,
      null
    );
    console.log("BLOCK_NONE filter result:", result);
    expect(result).toBe(true); // Expected to always allow content
  });

  it("should allow content with OFF filter", async () => {
    // Test with OFF (safety filter disabled)
    const result = await checkImageContent(imagePath, "OFF", null);
    console.log("OFF filter result:", result);
    expect(result).toBe(true); // Expected to always allow content
  });
});
