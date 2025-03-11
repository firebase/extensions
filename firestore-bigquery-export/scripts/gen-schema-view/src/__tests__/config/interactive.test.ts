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
      expect(questions).toHaveLength(5);
    });

    it("should have properly formatted questions with required properties", () => {
      questions.forEach((question) => {
        expect(question).toHaveProperty("message");
        expect(question).toHaveProperty("name");
        expect(question).toHaveProperty("type");
      });
    });

    it("should have proper validation for project ID question", () => {
      const projectQuestion = questions.find((q) => q.name === "project");
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
        (q) => q.name === "bigQueryProject"
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
      const datasetQuestion = questions.find((q) => q.name === "dataset");
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
        (q) => q.name === "project"
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
