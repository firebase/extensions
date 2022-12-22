const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./__tests__",
  preset: "ts-jest",
  testMatch: ["**/__tests__/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setupTests.ts"],
};
