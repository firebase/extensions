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
  gemini20Flash001: "gemini-2.0-flash-001",
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

  it("should return false when the API response is negative with custom prompt", async () => {
    // Mock negative response
    const mockGenerate = jest.fn().mockResolvedValue({
      output: {
        response: "no",
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
      "image/png"
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
        "image/png"
      )
    ).rejects.toThrow("API failure");
  });

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
    expect(callArgs.model).toBe("gemini-2.0-flash-001");
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

describe("checkImageContent retry mechanism", () => {
  // Test image path
  const imagePath = path.join(__dirname, "test-image.png");

  // Import mocked modules after they've been mocked
  const { genkit } = require("genkit");

  // Spy on setTimeout to verify it's being called
  let setTimeoutSpy;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock setTimeout to execute callback immediately
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback) => {
        callback();
        return {} as any;
      });

    // Spy on console.warn
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // Spy on console.error
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  it("should retry when a non-blocking error occurs", async () => {
    // First call fails, second call succeeds
    const mockGenerate = jest
      .fn()
      .mockRejectedValueOnce(new Error("API temporary failure"))
      .mockResolvedValueOnce({
        output: { response: "yes" },
      });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null,
      "image/png",
      2 // Set max attempts to 2
    );

    // Verify the function was called twice
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    // Verify that setTimeout was called once (for retry)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    // Verify console.warn was called for retry
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Retrying"),
      expect.any(Error)
    );

    // Verify the function returns true after successful retry
    expect(result).toBe(true);
  });

  it("should retry up to maxAttempts times before failing", async () => {
    // All attempts fail
    const mockGenerate = jest
      .fn()
      .mockRejectedValue(new Error("Persistent API failure"));

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const maxAttempts = 3;

    try {
      const result = await checkImageContent(
        imagePath,
        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        null,
        "image/png",
        maxAttempts
      );
    } catch (e) {
      // Ignore the error
    }

    // Verify the function was called maxAttempts times
    expect(mockGenerate).toHaveBeenCalledTimes(maxAttempts);

    // Verify that setTimeout was called (maxAttempts-1) times (for retries)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(maxAttempts - 1);

    // Verify console.warn was called for retries
    expect(console.warn).toHaveBeenCalledTimes(maxAttempts - 1);

    // Verify console.error was called for final failure
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to evaluate image content after multiple attempts"
      ),
      expect.any(Error)
    );
  });

  it("should not retry when content is blocked", async () => {
    // API returns blocked error
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
      3 // Set max attempts to 3
    );

    // Verify the function was called only once (no retries for blocked content)
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    // Verify that setTimeout was not called (no retries)
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    // Verify console.warn was called for blocked content
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Image content blocked by Vertex AI content filters"
      )
    );

    // Verify the function returns false for blocked content
    expect(result).toBe(false);
  });

  it("should implement exponential backoff in retries", async () => {
    // Reset the setTimeout mock to capture delays
    setTimeoutSpy.mockRestore();
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback, delay) => {
        callback();
        return {} as any;
      });

    // All attempts fail
    const mockGenerate = jest
      .fn()
      .mockRejectedValueOnce(new Error("First failure"))
      .mockRejectedValueOnce(new Error("Second failure"))
      .mockRejectedValue(new Error("Subsequent failures"));

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    try {
      await checkImageContent(
        imagePath,
        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        null,
        "image/png",
        3 // Set max attempts to 3
      );
    } catch (e) {
      // Ignore the error
    }

    // Verify setTimeout was called with increasing delays
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Extract the delay values from the setTimeout calls
    const firstDelay = setTimeoutSpy.mock.calls[0][1];
    const secondDelay = setTimeoutSpy.mock.calls[1][1];

    // Verify that second delay is greater than first delay (exponential backoff)
    expect(secondDelay).toBeGreaterThan(firstDelay);

    // Verify that delays match expected backoff pattern
    // First retry should use approximately 2^1 * 500 ms (plus some random jitter)
    expect(firstDelay).toBeGreaterThanOrEqual(500); // Lower bound
    expect(firstDelay).toBeLessThanOrEqual(1500); // Upper bound with jitter

    // Second retry should use approximately 2^2 * 500 ms (plus some random jitter)
    expect(secondDelay).toBeGreaterThanOrEqual(1500); // Lower bound
    expect(secondDelay).toBeLessThanOrEqual(2500); // Upper bound with jitter
  });

  it("should cap retry delays at 5000ms", async () => {
    // Reset the setTimeout mock to capture delays
    setTimeoutSpy.mockRestore();
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback, delay) => {
        callback();
        return {} as any;
      });

    // All attempts fail
    const mockGenerate = jest.fn().mockRejectedValue(new Error("API failure"));

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    try {
      await checkImageContent(
        imagePath,
        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        null,
        "image/png",
        10 // Set max attempts to a high number to test capping
      );
    } catch (e) {
      // Ignore the error
    }

    // Check if any delay exceeds 5000ms
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    const exceedsCap = delays.some((delay) => delay > 5000);

    // Verify no delay exceeds 5000ms
    expect(exceedsCap).toBe(false);

    // Verify that later retries have delays capped at 5000ms
    // By the 4th retry (index 3), the theoretical delay would be 2^4 * 500 = 8000ms
    if (delays.length >= 4) {
      expect(delays[3]).toBeLessThanOrEqual(5000);
    }
  }, 100000);

  it("should recover after intermittent failures", async () => {
    // Mock generate to fail twice then succeed
    const mockGenerate = jest
      .fn()
      .mockRejectedValueOnce(new Error("First API failure"))
      .mockRejectedValueOnce(new Error("Second API failure"))
      .mockResolvedValueOnce({
        output: { response: "yes" },
      });

    genkit.mockImplementation(() => ({
      generate: mockGenerate,
    }));

    const result = await checkImageContent(
      imagePath,
      HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      null,
      "image/png",
      5 // Set max attempts to 5
    );

    // Verify the function was called 3 times (2 failures + 1 success)
    expect(mockGenerate).toHaveBeenCalledTimes(3);

    // Verify that setTimeout was called twice (for retries)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Verify console.warn was called for retries
    expect(console.warn).toHaveBeenCalledTimes(2);

    // Verify the function returns true after successful retry
    expect(result).toBe(true);
  });
});
