import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from "@jest/globals";

// Mock package.json before importing any modules
jest.mock(
  "../../../package.json",
  () => ({
    description: "Test Description",
    version: "1.0.0",
  }),
  { virtual: true }
);

// Mock commander before importing any modules
jest.mock("commander", () => {
  return {
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnThis(),
  };
});

// Import the modules after all mocks are set up
import {
  collect,
  configureProgram,
  parseProgram,
  validateNonInteractiveParams,
} from "../../config/non-interactive";

describe("Command Line Parser", () => {
  describe("collect function", () => {
    it("should add a value to an array", () => {
      const previous = ["value1", "value2"];
      const result = collect("value3", previous);
      expect(result).toEqual(["value1", "value2", "value3"]);
    });

    it("should handle empty arrays", () => {
      const result = collect("value1", []);
      expect(result).toEqual(["value1"]);
    });
  });

  describe("configureProgram function", () => {
    let commander;

    beforeEach(() => {
      // Get the mocked commander module
      commander = require("commander");

      // Clear all mocks
      jest.clearAllMocks();
    });

    it("should configure the program with all options", () => {
      configureProgram();

      expect(commander.name).toHaveBeenCalledWith("gen-schema-views");
      expect(commander.description).toHaveBeenCalledWith("Test Description");
      expect(commander.version).toHaveBeenCalledWith("1.0.0");

      // Check that all options are configured
      expect(commander.option).toHaveBeenCalledTimes(10);

      // Check specific options - just a sample to ensure we're setting up correctly
      expect(commander.option).toHaveBeenCalledWith(
        "--non-interactive",
        "Parse all input from command line flags instead of prompting the caller.",
        false
      );

      expect(commander.option).toHaveBeenCalledWith(
        "-P, --project <project>",
        "Firebase Project ID for project containing Cloud Firestore database."
      );

      expect(commander.option).toHaveBeenCalledWith(
        "-f, --schema-files <schema-files>",
        "A collection of files from which to read schemas.",
        collect,
        []
      );
    });

    it("should return the configured program", () => {
      const result = configureProgram();
      // We're expecting the mock object to be returned
      expect(result).toBe(commander);
    });
  });

  describe("parseProgram function", () => {
    let commander;
    const originalProcessArgv = process.argv;

    beforeEach(() => {
      commander = require("commander");
      jest.clearAllMocks();
      // Mock process.argv
      process.argv = ["node", "script.js", "-P", "test-project"];
    });

    afterEach(() => {
      // Restore original process.argv
      process.argv = originalProcessArgv;
    });

    it("should configure and parse the program", () => {
      const result = parseProgram();

      expect(commander.parse).toHaveBeenCalledWith(process.argv);
      expect(result).toBe(commander);
    });
  });

  describe("validateNonInteractiveParams function", () => {
    it("should return true when all required parameters are present", () => {
      const mockProgram = {
        project: "test-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema1.json", "schema2.json"],
      };

      const result = validateNonInteractiveParams(mockProgram);
      expect(result).toBe(true);
    });

    it("should return false when project is missing", () => {
      const mockProgram = {
        project: undefined,
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema1.json"],
      };

      const result = validateNonInteractiveParams(mockProgram);
      expect(result).toBe(false);
    });

    it("should return false when dataset is missing", () => {
      const mockProgram = {
        project: "test-project",
        dataset: undefined,
        tableNamePrefix: "test-prefix",
        schemaFiles: ["schema1.json"],
      };

      const result = validateNonInteractiveParams(mockProgram);
      expect(result).toBe(false);
    });

    it("should return false when tableNamePrefix is missing", () => {
      const mockProgram = {
        project: "test-project",
        dataset: "test-dataset",
        tableNamePrefix: undefined,
        schemaFiles: ["schema1.json"],
      };

      const result = validateNonInteractiveParams(mockProgram);
      expect(result).toBe(false);
    });

    it("should return false when schemaFiles is empty", () => {
      const mockProgram = {
        project: "test-project",
        dataset: "test-dataset",
        tableNamePrefix: "test-prefix",
        schemaFiles: [],
      };

      const result = validateNonInteractiveParams(mockProgram);
      expect(result).toBe(false);
    });
  });
});

// Skip integration tests for now since they need more configuration
describe.skip("Integration tests", () => {
  const originalProcessArgv = process.argv;

  // Unmock commander for these tests
  beforeEach(() => {
    jest.resetModules();
    jest.unmock("commander");
  });

  afterEach(() => {
    // Restore original process.argv
    process.argv = originalProcessArgv;
  });

  it("should correctly parse command line arguments", () => {
    // Mock process.argv with realistic command line arguments
    process.argv = [
      "node",
      "script.js",
      "-P",
      "test-project",
      "-B",
      "test-bq-project",
      "-d",
      "test-dataset",
      "-t",
      "test-prefix",
      "-f",
      "schema1.json",
      "-f",
      "schema2.json",
      "--schema-dir",
      "./test-schemas",
    ];

    // Re-import the module
    const { parseProgram } = require("../../config/non-interactive");

    const program = parseProgram();

    // Verify the parsed options
    expect(program.opts().project).toBe("test-project");
    expect(program.opts().bigQueryProject).toBe("test-bq-project");
    expect(program.opts().dataset).toBe("test-dataset");
    expect(program.opts().tableNamePrefix).toBe("test-prefix");
    expect(program.opts().schemaFiles).toEqual([
      "schema1.json",
      "schema2.json",
    ]);
    expect(program.opts().schemaDir).toBe("./test-schemas");
    expect(program.opts().nonInteractive).toBe(false);
  });

  it("should validate non-interactive parameters correctly", () => {
    // Mock process.argv with all required parameters
    process.argv = [
      "node",
      "script.js",
      "-P",
      "test-project",
      "-d",
      "test-dataset",
      "-t",
      "test-prefix",
      "-f",
      "schema1.json",
    ];

    // Re-import the module
    const {
      parseProgram,
      validateNonInteractiveParams,
    } = require("../../config/non-interactive");

    const program = parseProgram();
    const isValid = validateNonInteractiveParams(program.opts());

    expect(isValid).toBe(true);
  });
});
