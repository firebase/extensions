/**
 * Copyright 2023 Google LLC
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

describe("Config", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      MODEL: "test-model",
      LOCATION: "test-location",
      PROJECT_ID: "test-project",
      EXT_INSTANCE_ID: "test-instance",
      COLLECTION_NAME: "test-collection",
      PROMPT_FIELD: "test-prompt",
      RESPONSE_FIELD: "test-response",
      ORDER_FIELD: "test-order",
      GENERATIVE_AI_PROVIDER: "google-ai",
      API_KEY: "test-api-key",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("Required Parameters", () => {
    it("should throw error when MODEL is not set", () => {
      delete process.env.MODEL;
      expect(() => require("../../src/config")).toThrow(
        /Missing required environment variables: MODEL/
      );
    });

    it("should throw error when LOCATION is not set", () => {
      delete process.env.LOCATION;
      expect(() => require("../../src/config")).toThrow(
        /Missing required environment variables: LOCATION/
      );
    });

    it("should throw error when PROJECT_ID is not set", () => {
      delete process.env.PROJECT_ID;
      expect(() => require("../../src/config")).toThrow(
        /Missing required environment variables: PROJECT_ID/
      );
    });

    it("should throw error when EXT_INSTANCE_ID is not set", () => {
      delete process.env.EXT_INSTANCE_ID;
      expect(() => require("../../src/config")).toThrow(
        /Missing required environment variables: EXT_INSTANCE_ID/
      );
    });
  });

  describe("Optional Parameters", () => {
    it("should use default values when optional parameters are not set", () => {
      delete process.env.COLLECTION_NAME;
      delete process.env.PROMPT_FIELD;
      delete process.env.RESPONSE_FIELD;
      delete process.env.ORDER_FIELD;

      const { default: config } = require("../../src/config");
      expect(config.collectionName).toBe(
        "users/{uid}/discussions/{discussionId}/messages"
      );
      expect(config.promptField).toBe("prompt");
      expect(config.responseField).toBe("response");
      expect(config.orderField).toBe("createTime");
    });

    it("should use provided values when optional parameters are set", () => {
      const { default: config } = require("../../src/config");
      expect(config.collectionName).toBe("test-collection");
      expect(config.promptField).toBe("test-prompt");
      expect(config.responseField).toBe("test-response");
      expect(config.orderField).toBe("test-order");
    });
  });

  describe("Provider Configuration", () => {
    it("should default to google-ai provider", () => {
      delete process.env.GENERATIVE_AI_PROVIDER;
      const {
        default: config,
        GenerativeAIProvider,
      } = require("../../src/config");
      expect(config.provider).toBe(GenerativeAIProvider.GOOGLE_AI);
    });

    it("should accept vertex-ai provider", () => {
      process.env.GENERATIVE_AI_PROVIDER = "vertex-ai";
      const {
        default: config,
        GenerativeAIProvider,
      } = require("../../src/config");
      expect(config.provider).toBe(GenerativeAIProvider.VERTEX_AI);
    });

    it("should require API_KEY for google-ai provider", () => {
      process.env.GENERATIVE_AI_PROVIDER = "google-ai";
      delete process.env.API_KEY;
      const { default: config } = require("../../src/config");
      expect(config.googleAi.apiKey).toBeUndefined();
    });

    it("should throw error for invalid provider", () => {
      process.env.GENERATIVE_AI_PROVIDER = "invalid-provider";
      expect(() => require("../../src/config")).toThrow("Invalid Provider");
    });
  });

  describe("Model Parameters", () => {
    it("should parse temperature as float", () => {
      process.env.TEMPERATURE = "0.5";
      const { default: config } = require("../../src/config");
      expect(config.temperature).toBe(0.5);
    });

    it("should parse topP as float", () => {
      process.env.TOP_P = "0.8";
      const { default: config } = require("../../src/config");
      expect(config.topP).toBe(0.8);
    });

    it("should parse topK as integer", () => {
      process.env.TOP_K = "40";
      const { default: config } = require("../../src/config");
      expect(config.topK).toBe(40);
    });

    it("should parse candidateCount as integer", () => {
      process.env.CANDIDATE_COUNT = "3";
      const { default: config } = require("../../src/config");
      expect(config.candidateCount).toBe(3);
    });

    it("should parse maxOutputTokens as integer", () => {
      process.env.MAX_OUTPUT_TOKENS = "1000";
      const { default: config } = require("../../src/config");
      expect(config.maxOutputTokens).toBe(1000);
    });
  });

  describe("Feature Flags", () => {
    it("should parse enableDiscussionOptionOverrides", () => {
      process.env.ENABLE_DISCUSSION_OPTION_OVERRIDES = "yes";
      const { default: config } = require("../../src/config");
      expect(config.enableDiscussionOptionOverrides).toBe(true);
    });

    it("should parse enableGenkitMonitoring", () => {
      process.env.ENABLE_GENKIT_MONITORING = "yes";
      const { default: config } = require("../../src/config");
      expect(config.enableGenkitMonitoring).toBe(true);
    });

    it("should default feature flags to false", () => {
      delete process.env.ENABLE_DISCUSSION_OPTION_OVERRIDES;
      delete process.env.ENABLE_GENKIT_MONITORING;
      const { default: config } = require("../../src/config");
      expect(config.enableDiscussionOptionOverrides).toBe(false);
      expect(config.enableGenkitMonitoring).toBe(false);
    });
  });

  describe("Safety Settings", () => {
    it("should parse safety settings for google-ai provider", () => {
      process.env.GENERATIVE_AI_PROVIDER = "google-ai";
      process.env.HARM_CATEGORY_HATE_SPEECH = "BLOCK_MEDIUM_AND_ABOVE";
      process.env.HARM_CATEGORY_DANGEROUS_CONTENT = "BLOCK_LOW_AND_ABOVE";
      const { default: config } = require("../../src/config");
      expect(config.safetySettings).toHaveLength(2);
      expect(config.safetySettings?.[0].category).toBe(
        "HARM_CATEGORY_HATE_SPEECH"
      );
      expect(config.safetySettings?.[0].threshold).toBe(
        "BLOCK_MEDIUM_AND_ABOVE"
      );
    });

    it("should parse safety settings for vertex-ai provider", () => {
      process.env.GENERATIVE_AI_PROVIDER = "vertex-ai";
      process.env.HARM_CATEGORY_HATE_SPEECH = "BLOCK_MEDIUM_AND_ABOVE";
      process.env.HARM_CATEGORY_DANGEROUS_CONTENT = "BLOCK_LOW_AND_ABOVE";
      const { default: config } = require("../../src/config");
      expect(config.safetySettings).toHaveLength(2);
      expect(config.safetySettings?.[0].category).toBe(
        "HARM_CATEGORY_HATE_SPEECH"
      );
      expect(config.safetySettings?.[0].threshold).toBe(
        "BLOCK_MEDIUM_AND_ABOVE"
      );
    });

    it("should return empty array when no safety settings are provided", () => {
      delete process.env.HARM_CATEGORY_HATE_SPEECH;
      delete process.env.HARM_CATEGORY_DANGEROUS_CONTENT;
      const { default: config } = require("../../src/config");
      expect(config.safetySettings).toEqual([]);
    });
  });

  describe("Context", () => {
    it("should parse context when provided", () => {
      process.env.CONTEXT = "test context";
      const { default: config } = require("../../src/config");
      expect(config.context).toBe("test context");
    });

    it("should be undefined when context is not provided", () => {
      delete process.env.CONTEXT;
      const { default: config } = require("../../src/config");
      expect(config.context).toBeUndefined();
    });
  });
});
