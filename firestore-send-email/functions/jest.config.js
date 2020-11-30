const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  globalSetup: "./jest.setup.js",
  globalTeardown: "./jest.teardown.js",
  testMatch: ["**/__tests__/*.test.ts"],
};
