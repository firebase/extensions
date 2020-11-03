const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  globalSetup: "<rootDir>/jest.setup.js",
  testMatch: ["**/__tests__/*.test.ts"],
};
