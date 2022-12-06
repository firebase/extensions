const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  testPathIgnorePatterns: process.env.CI_TEST === "true" ? ["e2e"] : [],
};
