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

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from "@jest/globals";

// Mock inquirer before importing any modules
jest.mock("inquirer", () => ({
  prompt: jest.fn(),
}));

// Import the modules after mocks are set up
import { questions, promptInquirer } from "../../config/interactive";
import inquirer from "inquirer";

describe("Interactive Prompts", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("questions array", () => {
    it("should have the correct number of questions", () => {
      expect(questions).toHaveLength(11);
    });

    it("should have properly formatted questions with required properties", () => {
      questions.forEach((question) => {
        expect(question).toHaveProperty("message");
        expect(question).toHaveProperty("name");
        expect(question).toHaveProperty("type");
      });
    });

    it("should have proper validation for project ID question", () => {
      const projectQuestion = questions.find((q) => q.name === "projectId");
      expect(projectQuestion).toBeDefined();

      // Test validation function
      const validate = projectQuestion.validate;

      // Empty value should return error message
      expect(validate("")).toBe("Please supply a project ID");

      // Invalid characters should return error message
      expect(validate("project/with/slashes")).toBe(
        "The project ID must only contain letters or spaces"
      );

      // Valid value should return true
      expect(validate("valid-project-id")).toBe(true);
    });

    it("should have proper validation for BigQuery project ID question", () => {
      const bigQueryQuestion = questions.find(
        (q) => q.name === "bigQueryProjectId"
      );
      expect(bigQueryQuestion).toBeDefined();

      // Test validation function
      const validate = bigQueryQuestion.validate;

      // Empty value should return error message
      expect(validate("")).toBe("Please supply a BigQuery project ID");

      // Invalid characters should return error message
      expect(validate("UPPERCASE_PROJECT")).toBe(
        "The BigQuery project ID must only contain letters or spaces"
      );
      expect(validate("123-starts-with-number")).toBe(
        "The BigQuery project ID must only contain letters or spaces"
      );

      // Valid value should return true
      expect(validate("valid-project-id")).toBe(true);
    });

    it("should have proper validation for dataset ID question", () => {
      const datasetQuestion = questions.find((q) => q.name === "datasetId");
      expect(datasetQuestion).toBeDefined();

      // Test validation function
      const validate = datasetQuestion.validate;

      // Empty value should return error message
      expect(validate("")).toBe("Please supply a dataset ID");

      // Invalid characters should return error message
      expect(validate("dataset-with-hyphens")).toBe(
        "The dataset ID must only contain letters or spaces"
      );

      // Valid value should return true
      expect(validate("valid_dataset_id")).toBe(true);
    });

    it("should have proper validation for table name prefix question", () => {
      const prefixQuestion = questions.find(
        (q) => q.name === "tableNamePrefix"
      );
      expect(prefixQuestion).toBeDefined();

      // Test validation function
      const validate = prefixQuestion.validate;

      // Empty value should return error message
      expect(validate("")).toBe("Please supply a table name prefix");

      // Invalid characters should return error message
      expect(validate("prefix-with-hyphens")).toBe(
        "The table name prefix must only contain letters or spaces"
      );

      // Valid value should return true
      expect(validate("valid_prefix_123")).toBe(true);
    });

    it("should conditionally show schema files question when not using Gemini", () => {
      const schemaFilesQuestion = questions.find(
        (q) => q.name === "schemaFiles"
      );
      expect(schemaFilesQuestion).toBeDefined();

      // Test when function
      const when = schemaFilesQuestion.when;

      // Should show when useGemini is false
      expect(when({ useGemini: false })).toBe(true);

      // Should not show when useGemini is true
      expect(when({ useGemini: true })).toBe(false);
    });

    it("should conditionally show Google AI API Key question when using Gemini", () => {
      const apiKeyQuestion = questions.find((q) => q.name === "googleAiKey");
      expect(apiKeyQuestion).toBeDefined();

      // Test when function
      const when = apiKeyQuestion.when;

      // Should show when useGemini is true
      expect(when({ useGemini: true })).toBe(true);

      // Should not show when useGemini is false
      expect(when({ useGemini: false })).toBe(false);

      // Test validation
      const validate = apiKeyQuestion.validate;
      expect(validate("")).toBe("Google AI API Key is required");
      expect(validate("valid-api-key")).toBe(true);
    });

    it("should conditionally show collection path question when using Gemini", () => {
      const collectionPathQuestion = questions.find(
        (q) => q.name === "geminiAnalyzeCollectionPath"
      );
      expect(collectionPathQuestion).toBeDefined();

      // Test when function
      const when = collectionPathQuestion.when;

      // Should show when useGemini is true
      expect(when({ useGemini: true })).toBe(true);

      // Should not show when useGemini is false
      expect(when({ useGemini: false })).toBe(false);
    });

    it("should conditionally show schema directory question with default value when using Gemini", () => {
      const schemaDirQuestion = questions.find(
        (q) => q.name === "schemaDirectory"
      );
      expect(schemaDirQuestion).toBeDefined();

      // Test when function
      const when = schemaDirQuestion.when;

      // Should show when useGemini is true
      expect(when({ useGemini: true })).toBe(true);

      // Should not show when useGemini is false
      expect(when({ useGemini: false })).toBe(false);

      // Should have default value
      expect(schemaDirQuestion.default).toBe("./schemas");
    });
  });

  describe("promptInquirer function", () => {
    it("should call inquirer.prompt with questions array", async () => {
      // Setup mock return value
      const mockAnswers = { project: "test-project" };
      (
        inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>
      ).mockResolvedValueOnce(mockAnswers);

      // Call the function
      const result = await promptInquirer();

      // Verify inquirer.prompt was called with questions
      expect(inquirer.prompt).toHaveBeenCalledWith(questions);

      // Verify the function returns the mock answers
      expect(result).toEqual(mockAnswers);
    });

    it("should propagate errors from inquirer.prompt", async () => {
      // Setup mock to throw error
      const mockError = new Error("Prompt failed");
      (
        inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>
      ).mockRejectedValueOnce(mockError);

      // Call the function and expect it to throw
      await expect(promptInquirer()).rejects.toThrow("Prompt failed");
    });
  });

  describe("validateInput function (indirectly tested through questions)", () => {
    it("should handle various input cases for text validation", () => {
      // Get validation functions from questions to test the validateInput indirectly
      const projectValidate = questions.find(
        (q) => q.name === "projectId"
      ).validate;

      // Test empty values
      expect(projectValidate("")).toBe("Please supply a project ID");
      expect(projectValidate(null)).toBe("Please supply a project ID");
      expect(projectValidate(undefined)).toBe("Please supply a project ID");
      expect(projectValidate("   ")).toBe("Please supply a project ID");

      // Test invalid values (with slashes for Firestore validation)
      expect(projectValidate("invalid/path")).toBe(
        "The project ID must only contain letters or spaces"
      );

      // Test valid values
      expect(projectValidate("valid-project")).toBe(true);
      expect(projectValidate("another_valid_project")).toBe(true);
    });
  });
});
