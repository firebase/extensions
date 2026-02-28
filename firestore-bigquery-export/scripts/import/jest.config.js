const packageJson = require("./package.json");

module.exports = {
  displayName: packageJson.name,
  rootDir: "./",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/__tests__/tsconfig.json",
    },
  },
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  testEnvironment: "node",
  testTimeout: 180000,
  collectCoverage: true,
  testPathIgnorePatterns: process.env.CI_TEST === "true" ? ["example"] : [],
};
