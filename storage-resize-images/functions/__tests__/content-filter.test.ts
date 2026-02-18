import { checkImageContent } from "../src/content-filter"; // Update this import path
import * as path from "path";
import { HarmBlockThreshold } from "@google-cloud/vertexai";

// Mock genkit module
jest.mock("genkit", () => ({
  genkit: jest.fn(),
  z: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
  },
}));

// Mock vertexAI module
jest.mock("@genkit-ai/vertexai", () => ({
  __esModule: true,
  default: jest.fn(),
  gemini: jest.fn((version: string) => ({ name: `vertexai/${version}` })),
}));

// Mock the sleep function to avoid actual waiting in tests
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from("mockImageData")),
}));

jest.mock("mime", () => ({
  lookup: jest.fn().mockReturnValue("image/png"),
}));

describe("checkImageContent with mocks", () => {
  // Test image path - using the same path as in your original test suite
  const imagePath = path.join(__dirname, "gun-image.png");

  // Import mocked modules after they've been mocked
  const { genkit } = require("genkit");

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default mock for successful response
    genkit.mockImplementation(() => ({
      generate: jest.fn().mockResolvedValue({
        output: {
          response: "yes",
        },
      }),
    }));
  });

  it("should return true when filter level is OFF and no custom prompt", async () => {
    const result = await checkImageContent(imagePath, null, null, "image/png");

    // Verify no API call was made
    expect(genkit).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("should return true when the API response is positive", async () => {
    // Mock successful response
    const mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "yes",
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null,
      "image/png"
    );

    // Verify API call was made
    expect(genkit).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("should return false when the API response is to filter with custom prompt", async () => {
    // Mock negative response
    const mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "yes",
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      "Is this image containing inappropriate content?",
      "image/png"
    );

    expect(genkit).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("should return false when API throws a 'blocked' finish reason", async () => {
    // Mock API throwing blocked error
    const mockGenerate = jest.fn().mockRejectedValue({
      detail: {
        response: {
          finishReason: "blocked",
        },
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null,
      "image/png",
      1
    );

    expect(genkit).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("should rethrow when error occurs", async () => {
    // Mock API throwing generic error
    const mockGenerate = jest.fn().mockRejectedValue(new Error("API failure"));

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    await expect(
      checkImageContent(
        imagePath,
        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        null,
        "image/png",
        1
      )
    ).rejects.toThrow("API failure");
  }, 60000);

  it("should pass correct parameters to generate for default prompt", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "yes",
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null,
      "image/png"
    );

    // Verify the call parameters
    expect(mockGenerate).toHaveBeenCalled();
    const callArgs = mockGenerate.mock.calls[0][0];

    // Check basic structure without checking exact values of complex objects
    expect(callArgs.model?.name ?? callArgs.model).toBe(
      "vertexai/gemini-2.5-flash"
    );
    expect(callArgs.messages[0].role).toBe("user");
    expect(callArgs.messages[0].content[0].text).toBe(
      "Is this image appropriate?"
    );
    expect(callArgs.messages[0].content[1].media).toBeDefined();
    expect(callArgs.config.temperature).toBe(0.1);
    expect(callArgs.config.maxOutputTokens).toBe(1);
  });

  it("should pass correct parameters to generate for custom prompt", async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "yes",
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const customPrompt = "Does this image contain violent content?";

    await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      customPrompt,
      "image/png"
    );

    // Verify the call parameters
    expect(mockGenerate).toHaveBeenCalled();
    const callArgs = mockGenerate.mock.calls[0][0];

    expect(callArgs.messages[0].content[0].text).toContain(customPrompt);
    expect(callArgs.config.maxOutputTokens).toBe(100);
  });

  it("should test the image using both BLOCK_LOW_AND_ABOVE and BLOCK_ONLY_HIGH filters", async () => {
    // Test with two different filter levels

    // First: BLOCK_LOW_AND_ABOVE - should block the content
    let mockGenerate = jest.fn().mockRejectedValue({
      detail: {
        response: {
          finishReason: "blocked",
        },
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    let result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      null,
      "image/png"
    );

    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(false);

    // Reset mocks
    jest.clearAllMocks();

    // Second: BLOCK_ONLY_HIGH - should allow the content
    mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "yes",
      },
    });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_ONLY_HIGH,
      null,
      "image/png"
    );

    expect(mockGenerate).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
