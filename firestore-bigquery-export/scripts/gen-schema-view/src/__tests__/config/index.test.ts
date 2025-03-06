import { parseConfig } from "../../../src/config";
import { promptInquirer } from "../../../src/config/interactive";
import {
  parseProgram,
  validateNonInteractiveParams,
} from "../../../src/config/non-interactive";
import { readSchemas } from "../../../src/schema-loader-utils";

// Mock dependencies
jest.mock("../../../src/config/interactive", () => ({
  promptInquirer: jest.fn(),
}));

jest.mock("../../../src/config/non-interactive", () => ({
  parseProgram: jest.fn(),
  validateNonInteractiveParams: jest.fn(),
}));

jest.mock("../../../src/schema-loader-utils", () => ({
  readSchemas: jest.fn(),
}));

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`Process exited with code ${code}`);
});

describe("parseConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Non-interactive mode", () => {
    it("should return CLI config from command line arguments", async () => {
      // Setup mocks for non-interactive mode
      const mockProgram = {
        nonInteractive: true,
        project: "test-project",
        bigQueryProject: "test-bq-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema1.json", "schema2.json"],
        outputHelp: jest.fn(),
      };

      const mockSchemas = {
        schema1: { fields: { field1: { type: "string" } } },
        schema2: { fields: { field2: { type: "number" } } },
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (validateNonInteractiveParams as jest.Mock).mockReturnValue(true);
      (readSchemas as jest.Mock).mockReturnValue(mockSchemas);

      const result = await parseConfig();

      expect(parseProgram).toHaveBeenCalled();
      expect(validateNonInteractiveParams).toHaveBeenCalledWith(mockProgram);
      expect(readSchemas).toHaveBeenCalledWith(mockProgram.schemaFiles);
      expect(result).toEqual({
        agentSampleSize: 100,
        projectId: "test-project",
        bigQueryProjectId: "test-bq-project",
        datasetId: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemas: mockSchemas,
        geminiAnalyzeCollectionPath: undefined,
        googleAiKey: undefined,
        schemaDirectory: undefined,
        useGemini: undefined,
      });
    });

    it("should use project as bigQueryProject if not specified", async () => {
      // Setup mocks with missing bigQueryProject
      const mockProgram = {
        nonInteractive: true,
        project: "test-project",
        bigQueryProject: undefined,
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema.json"],
        outputHelp: jest.fn(),
      };

      const mockSchemas = { schema: { fields: { field: { type: "string" } } } };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (validateNonInteractiveParams as jest.Mock).mockReturnValue(true);
      (readSchemas as jest.Mock).mockReturnValue(mockSchemas);

      const result = await parseConfig();

      expect(result.bigQueryProjectId).toBe("test-project");
    });

    it("should use gemini if specified", async () => {
      // Setup mocks with useGemini = true
      const mockProgram = {
        nonInteractive: true,
        project: "test-project",
        bigQueryProject: "test-bq-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema.json"],
        useGemini: true,
        googleAiKey: "test-key",
        geminiAnalyzeCollectionPath: "test-collection",
        schemaDirectory: "test-directory",
        outputHelp: jest.fn(),
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (validateNonInteractiveParams as jest.Mock).mockReturnValue(true);

      const result = await parseConfig();

      expect(result.useGemini).toBe(true);
      expect(result.googleAiKey).toBe("test-key");
      expect(result.geminiAnalyzeCollectionPath).toBe("test-collection");
      expect(result.schemaDirectory).toBe("test-directory");
      expect(result.agentSampleSize).toBe(100);
    });

    it("should exit if required parameters are missing", async () => {
      const mockProgram = {
        nonInteractive: true,
        outputHelp: jest.fn(),
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (validateNonInteractiveParams as jest.Mock).mockReturnValue(false);

      await expect(parseConfig()).rejects.toThrow("Process exited with code 1");
      expect(mockProgram.outputHelp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("Interactive mode without Gemini", () => {
    it("should return CLI config from inquirer prompts", async () => {
      // Setup mocks for interactive mode
      const mockProgram = {
        nonInteractive: false,
      };

      const mockPromptResponse = {
        project: "interactive-project",
        bigQueryProject: "interactive-bq-project",
        dataset: "interactive-dataset",
        tableNamePrefix: "interactive-prefix",
        useGemini: false,
        schemaFiles: "schema1.json, schema2.json",
      };

      const mockSchemas = {
        schema1: { fields: { field1: { type: "string" } } },
        schema2: { fields: { field2: { type: "number" } } },
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (promptInquirer as jest.Mock).mockResolvedValue(mockPromptResponse);
      (readSchemas as jest.Mock).mockReturnValue(mockSchemas);

      const result = await parseConfig();

      expect(parseProgram).toHaveBeenCalled();
      expect(promptInquirer).toHaveBeenCalled();
      // Expect the schemaFiles string to be passed as-is in an array
      expect(readSchemas).toHaveBeenCalledWith(["schema1.json, schema2.json"]);
      expect(result).toEqual({
        agentSampleSize: 100,
        projectId: "interactive-project",
        bigQueryProjectId: "interactive-bq-project",
        datasetId: "interactive-dataset",
        tableNamePrefix: "interactive-prefix",
        schemas: mockSchemas,
        geminiAnalyzeCollectionPath: undefined,
        googleAiKey: undefined,
        schemaDirectory: undefined,
        useGemini: false,
      });
    });

    it("should properly handle schema file paths without trimming or splitting", async () => {
      const mockProgram = {
        nonInteractive: false,
      };

      const mockPromptResponse = {
        project: "test-project",
        bigQueryProject: "test-bq-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        useGemini: false,
        schemaFiles: " schema1.json,  schema2.json , schema3.json",
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (promptInquirer as jest.Mock).mockResolvedValue(mockPromptResponse);
      (readSchemas as jest.Mock).mockReturnValue({});

      await parseConfig();

      // Verify that the schemaFiles string is passed as-is within an array
      expect(readSchemas).toHaveBeenCalledWith([
        " schema1.json,  schema2.json , schema3.json",
      ]);
    });
  });

  describe("Interactive mode with Gemini", () => {
    it("should return CLI config from inquirer prompts", async () => {
      // Setup mocks for interactive mode
      const mockProgram = {
        nonInteractive: false,
      };

      const mockPromptResponse = {
        project: "interactive-project",
        bigQueryProject: "interactive-bq-project",
        dataset: "interactive-dataset",
        tableNamePrefix: "interactive-prefix",
        useGemini: true,
        googleAiKey: "test-key",
        geminiAnalyzeCollectionPath: "test-collection",
        schemaDirectory: "test-directory",
      };

      // Although we set up mockSchemas, in Gemini mode readSchemas is not called.
      const mockSchemas = {
        schema1: { fields: { field1: { type: "string" } } },
        schema2: { fields: { field2: { type: "number" } } },
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (promptInquirer as jest.Mock).mockResolvedValue(mockPromptResponse);
      (readSchemas as jest.Mock).mockReturnValue(mockSchemas);

      const result = await parseConfig();

      expect(parseProgram).toHaveBeenCalled();
      expect(promptInquirer).toHaveBeenCalled();
      // In Gemini mode, schemaFiles may not be provided so readSchemas should not be called
      expect(readSchemas).not.toHaveBeenCalled();
      // Expect schemas to be an empty object in Gemini mode
      expect(result).toEqual({
        agentSampleSize: 100,
        projectId: "interactive-project",
        bigQueryProjectId: "interactive-bq-project",
        datasetId: "interactive-dataset",
        tableNamePrefix: "interactive-prefix",
        schemas: {},
        geminiAnalyzeCollectionPath: "test-collection",
        googleAiKey: "test-key",
        schemaDirectory: "test-directory",
        useGemini: true,
      });
    });
  });
});
