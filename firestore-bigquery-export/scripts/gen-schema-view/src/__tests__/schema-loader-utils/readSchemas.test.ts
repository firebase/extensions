/*
 * Copyright 2025 Google LLC
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

import { readSchemas, filePathToSchemaName } from "../../schema-loader-utils";
import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";

// Mock dependencies
jest.mock("fs");
jest.mock("glob");
jest.mock("path");

describe("Schema Loader Utilities", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("should handle comma-separated file paths", () => {
    // Mock file system stats
    const mockStats = {
      isDirectory: jest.fn().mockReturnValue(false),
    };
    (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

    // Mock path resolution
    (path.basename as jest.Mock)
      .mockReturnValueOnce("users.json")
      .mockReturnValueOnce("posts.json");

    // Mock glob expansion
    (glob.sync as jest.Mock)
      .mockReturnValueOnce(["/path/to/users.json"])
      .mockReturnValueOnce(["/path/to/posts.json"]);

    // Mock schemas
    jest.mock(
      "/path/to/users.json",
      () => ({
        fields: { name: { type: "string" } },
      }),
      { virtual: true }
    );

    jest.mock(
      "/path/to/posts.json",
      () => ({
        fields: { title: { type: "string" } },
      }),
      { virtual: true }
    );

    // Call the function with comma-separated paths
    const result = readSchemas(["users.json,posts.json"]);

    // Validate results
    expect(glob.sync).toHaveBeenCalledTimes(2);
    expect(fs.lstatSync).toHaveBeenCalledTimes(2);
    expect(mockStats.isDirectory).toHaveBeenCalledTimes(2);

    // Verify schemas were loaded correctly
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("posts");
  });

  test("should read schemas from a directory", () => {
    // Mock file system stats to indicate a directory
    const mockStats = {
      isDirectory: jest.fn().mockReturnValue(true),
    };
    (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

    // Mock directory reading
    (fs.readdirSync as jest.Mock).mockReturnValue(["users.json", "posts.json"]);

    // Mock basename for each file
    (path.basename as jest.Mock)
      .mockReturnValueOnce("users.json")
      .mockReturnValueOnce("posts.json");

    // Mock glob expansion
    (glob.sync as jest.Mock).mockReturnValue(["/path/to/schemas"]);

    // Mock schemas
    jest.mock(
      "/path/to/schemas/users.json",
      () => ({
        fields: { name: { type: "string" } },
      }),
      { virtual: true }
    );

    jest.mock(
      "/path/to/schemas/posts.json",
      () => ({
        fields: { title: { type: "string" } },
      }),
      { virtual: true }
    );

    // Call the function
    const result = readSchemas(["schemas"]);

    // Validate results
    expect(glob.sync).toHaveBeenCalled();
    expect(fs.lstatSync).toHaveBeenCalled();
    expect(mockStats.isDirectory).toHaveBeenCalled();
    expect(fs.readdirSync).toHaveBeenCalled();

    // Verify schemas were loaded
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("posts");
  });

  test("should handle glob patterns", () => {
    // Mock file system stats
    const mockStats = {
      isDirectory: jest.fn().mockReturnValue(false),
    };
    (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

    // Mock path resolution
    (path.basename as jest.Mock)
      .mockReturnValueOnce("users.json")
      .mockReturnValueOnce("admins.json");

    // Mock glob expansion to return multiple files
    (glob.sync as jest.Mock).mockReturnValue([
      "/path/to/users.json",
      "/path/to/admins.json",
    ]);

    // Mock schemas
    jest.mock(
      "/path/to/users.json",
      () => ({
        fields: { name: { type: "string" } },
      }),
      { virtual: true }
    );

    jest.mock(
      "/path/to/admins.json",
      () => ({
        fields: { email: { type: "string" } },
      }),
      { virtual: true }
    );

    // Call the function with a glob pattern
    const result = readSchemas(["*.json"]);

    // Validate results
    expect(glob.sync).toHaveBeenCalledWith("*.json");
    expect(fs.lstatSync).toHaveBeenCalledTimes(2);
    expect(mockStats.isDirectory).toHaveBeenCalledTimes(2);

    // Verify schemas were loaded
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("admins");
  });

  test("should warn about duplicate schema names", () => {
    // Mock console.log to detect warning
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Mock file system stats
    const mockStats = {
      isDirectory: jest.fn().mockReturnValue(false),
    };
    (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

    // Mock path resolution to return the same filename twice
    (path.basename as jest.Mock)
      .mockReturnValueOnce("users.json")
      .mockReturnValueOnce("users.json");

    // Mock glob expansion
    (glob.sync as jest.Mock)
      .mockReturnValueOnce(["/path/to/users.json"])
      .mockReturnValueOnce(["/path/to/other/users.json"]);

    // Mock schemas
    jest.mock(
      "/path/to/users.json",
      () => ({
        fields: { name: { type: "string" } },
      }),
      { virtual: true }
    );

    jest.mock(
      "/path/to/other/users.json",
      () => ({
        fields: { fullName: { type: "string" } },
      }),
      { virtual: true }
    );

    // Call the function with two files that will generate the same schema name
    const result = readSchemas(["users1.json", "users2.json"]);

    // Verify warning was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Found multiple schema files named users!")
    );

    // Verify the last schema wins
    expect(result).toHaveProperty("users");

    consoleSpy.mockRestore();
  });

  test("should convert file path to schema name correctly", () => {
    // Test the filePathToSchemaName function

    // Setup mocking
    (path.basename as jest.Mock).mockReturnValue("user-profile.json");

    // Test hyphen conversion
    expect(filePathToSchemaName("/path/to/user-profile.json")).toBe(
      "user_profile"
    );

    // Reset and test multiple extensions
    jest.resetAllMocks();
    (path.basename as jest.Mock).mockReturnValue("data.export.json");
    expect(filePathToSchemaName("/path/to/data.export.json")).toBe(
      "data.export"
    );
  });

  describe("Schema Loader Edge Cases", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test("should handle non-existent files gracefully", () => {
      // Mock glob.sync to return a file path
      (glob.sync as jest.Mock).mockReturnValue(["/path/to/nonexistent.json"]);

      // Mock lstatSync to throw an error (file doesn't exist)
      (fs.lstatSync as jest.Mock).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      // Verify that an error is thrown
      expect(() => {
        readSchemas(["nonexistent.json"]);
      }).toThrow();
    });

    test("should handle empty or invalid schema files", () => {
      // Mock file system stats
      const mockStats = {
        isDirectory: jest.fn().mockReturnValue(false),
      };
      (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

      // Mock path resolution
      (path.basename as jest.Mock).mockReturnValue("empty.json");

      // Mock glob expansion
      (glob.sync as jest.Mock).mockReturnValue(["/path/to/empty.json"]);

      // Mock an empty schema
      jest.mock("/path/to/empty.json", () => ({}), { virtual: true });

      // Call the function
      const result = readSchemas(["empty.json"]);

      // Verify an empty schema was loaded
      expect(result).toHaveProperty("empty");
      expect(result.empty).toEqual({});
    });

    test("should handle multiple glob patterns in array", () => {
      // Mock file system stats
      const mockStats = {
        isDirectory: jest.fn().mockReturnValue(false),
      };
      (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

      // Mock path resolution
      (path.basename as jest.Mock)
        .mockReturnValueOnce("users.json")
        .mockReturnValueOnce("posts.json")
        .mockReturnValueOnce("comments.json");

      // Mock glob expansion for different patterns
      (glob.sync as jest.Mock)
        .mockReturnValueOnce(["/path/to/users.json"])
        .mockReturnValueOnce(["/path/to/posts.json", "/path/to/comments.json"]);

      // Mock schemas
      jest.mock(
        "/path/to/users.json",
        () => ({ fields: { name: { type: "string" } } }),
        { virtual: true }
      );
      jest.mock(
        "/path/to/posts.json",
        () => ({ fields: { title: { type: "string" } } }),
        { virtual: true }
      );
      jest.mock(
        "/path/to/comments.json",
        () => ({ fields: { text: { type: "string" } } }),
        { virtual: true }
      );

      // Call the function with multiple glob patterns
      const result = readSchemas(["users.json", "post*.json"]);

      // Validate results
      expect(glob.sync).toHaveBeenCalledTimes(2);
      expect(glob.sync).toHaveBeenCalledWith("users.json");
      expect(glob.sync).toHaveBeenCalledWith("post*.json");

      // Verify schemas were loaded
      expect(result).toHaveProperty("users");
      expect(result).toHaveProperty("posts");
      expect(result).toHaveProperty("comments");
    });

    test("should handle different path formats correctly", () => {
      // Mock file system stats
      const mockStats = {
        isDirectory: jest.fn().mockReturnValue(false),
      };
      (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

      // Mock path.basename
      (path.basename as jest.Mock).mockReturnValue("schema.json");

      // Mock glob expansion for different path formats
      (glob.sync as jest.Mock)
        .mockReturnValueOnce(["/absolute/path/schema.json"])
        .mockReturnValueOnce(["./relative/path/schema.json"]);

      // Setup mocks for resolveFilePath (checking path starts with)
      const processCwdSpy = jest
        .spyOn(process, "cwd")
        .mockReturnValue("/current/dir");

      // Mock schemas
      jest.mock(
        "/absolute/path/schema.json",
        () => ({ fields: { absolute: { type: "string" } } }),
        { virtual: true }
      );
      jest.mock(
        "/current/dir/./relative/path/schema.json",
        () => ({ fields: { relative: { type: "string" } } }),
        { virtual: true }
      );

      // Test absolute path
      let result = readSchemas(["/absolute/path/schema.json"]);
      expect(result).toHaveProperty("schema");
      expect(glob.sync).toHaveBeenCalledWith("/absolute/path/schema.json");

      // Reset mocks for second test
      jest.clearAllMocks();
      (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);
      (path.basename as jest.Mock).mockReturnValue("schema.json");
      processCwdSpy.mockReturnValue("/current/dir");

      // Test relative path
      result = readSchemas(["./relative/path/schema.json"]);
      expect(result).toHaveProperty("schema");
      expect(glob.sync).toHaveBeenCalledWith("./relative/path/schema.json");

      processCwdSpy.mockRestore();
    });

    test("should handle unusual filenames when converting to schema names", () => {
      // Test various unusual filenames

      // Setup mocking
      (path.basename as jest.Mock).mockReturnValueOnce(
        "user-name.with-hyphens.json"
      );
      expect(filePathToSchemaName("/path/to/user-name.with-hyphens.json")).toBe(
        "user_name.with_hyphens"
      );

      // Multi-dot extensions
      (path.basename as jest.Mock).mockReturnValueOnce(
        "file.name.with.dots.json"
      );
      expect(filePathToSchemaName("/path/to/file.name.with.dots.json")).toBe(
        "file.name.with.dots"
      );

      // Spaces in filename
      (path.basename as jest.Mock).mockReturnValueOnce(
        "file name with spaces.json"
      );
      expect(filePathToSchemaName("/path/to/file name with spaces.json")).toBe(
        "file name with spaces"
      );
    });

    test("should handle empty directory", () => {
      // Mock file system stats to indicate a directory
      const mockStats = {
        isDirectory: jest.fn().mockReturnValue(true),
      };
      (fs.lstatSync as jest.Mock).mockReturnValue(mockStats);

      // Mock directory reading to return empty array (empty directory)
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      // Mock glob expansion
      (glob.sync as jest.Mock).mockReturnValue(["/path/to/empty-dir"]);

      // Call the function
      const result = readSchemas(["empty-dir"]);

      // Validate results
      expect(glob.sync).toHaveBeenCalled();
      expect(fs.lstatSync).toHaveBeenCalled();
      expect(mockStats.isDirectory).toHaveBeenCalled();
      expect(fs.readdirSync).toHaveBeenCalled();

      // Verify no schemas were loaded
      expect(Object.keys(result).length).toBe(0);
    });
  });
});
