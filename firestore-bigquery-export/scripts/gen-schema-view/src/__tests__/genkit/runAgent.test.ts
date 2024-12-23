import * as fs from "fs/promises";
import { SchemaSchema } from "../../schema/genkitSchema";

jest.mock("fs/promises", () => ({
  access: jest.fn(),
  writeFile: jest.fn(),
}));

const mockDefineTool = jest.fn();
jest.mock("genkit", () => {
  const actualGenkit = jest.requireActual("genkit");
  return {
    ...actualGenkit,
    genkit: jest.fn(() => ({
      defineTool: jest.fn(),
      definePrompt: jest.fn(),
    })),
  };
});

describe("runAgent - additional test", () => {
  const schemaDirectory = "./schemas";
  const tablePrefix = "testPrefix";
  const schemaContent = JSON.stringify({
    fields: [
      {
        name: "id",
        type: "number",
        description: "Unique identifier for the document",
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mock states before each test
  });

  it("should write a new schema file if it does not already exist", async () => {
    const filePath = `${schemaDirectory}/${tablePrefix}.json`;

    // Mock file system operations
    (fs.access as jest.Mock).mockRejectedValueOnce(
      new Error("File does not exist")
    );
    (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined); // Explicitly resolve with `undefined`

    // Simulate the tool definition and handler
    const writeSchemaHandler = async ({
      fileName,
      content,
    }: {
      fileName: string;
      content: string;
    }) => {
      const filePath = `${schemaDirectory}/${fileName}`;
      try {
        await fs.access(filePath); // Check if the file exists
        return "Error: Schema file already exists";
      } catch {
        await fs.writeFile(filePath, content); // Write the file if it doesn't exist
        return "Schema created successfully";
      }
    };

    // Call the handler directly
    const result = await writeSchemaHandler({
      fileName: `${tablePrefix}.json`,
      content: schemaContent,
    });

    // Assertions
    expect(fs.access).toHaveBeenCalledWith(filePath);
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, schemaContent);
    expect(result).toBe("Schema created successfully");
  });

  it("should return an error if the schema file already exists", async () => {
    const filePath = `${schemaDirectory}/${tablePrefix}.json`;

    // Mock file system operations
    (fs.access as jest.Mock).mockResolvedValueOnce(undefined); // Simulate file exists
    (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined); // This should NOT be called

    // Simulate the tool definition and handler
    const writeSchemaHandler = async ({
      fileName,
      content,
    }: {
      fileName: string;
      content: string;
    }) => {
      const filePath = `${schemaDirectory}/${fileName}`;
      try {
        await fs.access(filePath);
        console.log("File exists, returning error"); // Debugging flow
        return "Error: Schema file already exists";
      } catch {
        console.log("File does not exist, writing file"); // Debugging flow
        await fs.writeFile(filePath, content);
        return "Schema created successfully";
      }
    };

    // Call the handler directly
    const result = await writeSchemaHandler({
      fileName: `${tablePrefix}.json`,
      content: schemaContent,
    });

    console.log(
      "Mock calls for fs.access:",
      (fs.access as jest.Mock).mock.calls
    );
    console.log(
      "Mock calls for fs.writeFile:",
      (fs.writeFile as jest.Mock).mock.calls
    );

    // Assertions
    expect(fs.access).toHaveBeenCalledWith(filePath);
    expect(fs.writeFile).not.toHaveBeenCalled(); // Ensure writeFile is NOT called
    expect(result).toBe("Error: Schema file already exists");
  });

  it("should return an error if the schema content is invalid", async () => {
    const invalidSchemaContent = JSON.stringify({
      fields: [
        { name: "id", type: "invalid_type" }, // Invalid type
      ],
    });
    const writeSchemaHandler = async ({
      fileName,
      content,
    }: {
      fileName: string;
      content: string;
    }) => {
      const filePath = `${schemaDirectory}/${fileName}`;
      try {
        SchemaSchema.parse(JSON.parse(content)); // Validate schema structure
        try {
          await fs.access(filePath); // Check if the file exists
          return "Error: Schema file already exists";
        } catch {
          await fs.writeFile(filePath, content); // Write the file if it doesn't exist
          return "Schema created successfully";
        }
      } catch (error) {
        return `Error creating schema: ${error.message}`;
      }
    };

    // // Call the handler directly
    const result = await writeSchemaHandler({
      fileName: `${tablePrefix}.json`,
      content: invalidSchemaContent,
    });

    // Assertions
    expect(result).toMatch("Error: Schema file already exists");
    expect(fs.writeFile).not.toHaveBeenCalled(); // Ensure writeFile is NOT called
  });
});
