const packageJson = require("./functions/package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  globalSetup: "./jest.setup.js",
  globalTeardown: "./jest.teardown.js",
};
