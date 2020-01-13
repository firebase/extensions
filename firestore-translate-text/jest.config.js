const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  setupFiles: ["<rootDir>/__tests__/jest.setup.js"],
  testMatch: ["**/__tests__/*.test.ts"],
};