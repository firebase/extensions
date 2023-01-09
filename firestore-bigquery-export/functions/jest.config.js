const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/tsconfig.json",
    },
  },
  preset: "ts-jest",
  setupFiles: ["<rootDir>/__tests__/jest.setup.ts"],
  testMatch: ["**/__tests__/*.test.ts"],
  testPathIgnorePatterns: process.env.CI_TEST === "true" ? ["e2e"] : [],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-functions/v2": "<rootDir>/node_modules/firebase-functions/lib/v2",
  },
};
