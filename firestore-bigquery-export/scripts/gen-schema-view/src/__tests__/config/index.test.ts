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
        projectId: "test-project",
        bigQueryProjectId: "test-bq-project",
        datasetId: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemas: mockSchemas,
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

  describe("Interactive mode", () => {
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
      expect(readSchemas).toHaveBeenCalledWith([
        "schema1.json",
        "schema2.json",
      ]);
      expect(result).toEqual({
        projectId: "interactive-project",
        bigQueryProjectId: "interactive-bq-project",
        datasetId: "interactive-dataset",
        tableNamePrefix: "interactive-prefix",
        schemas: mockSchemas,
      });
    });

    it("should properly trim and split schema file paths", async () => {
      const mockProgram = {
        nonInteractive: false,
      };

      const mockPromptResponse = {
        project: "test-project",
        bigQueryProject: "test-bq-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: " schema1.json,  schema2.json , schema3.json",
      };

      (parseProgram as jest.Mock).mockReturnValue(mockProgram);
      (promptInquirer as jest.Mock).mockResolvedValue(mockPromptResponse);
      (readSchemas as jest.Mock).mockReturnValue({});

      await parseConfig();

      // Verify that file paths are properly trimmed and split
      expect(readSchemas).toHaveBeenCalledWith([
        "schema1.json",
        "schema2.json",
        "schema3.json",
      ]);
    });
  });
});
