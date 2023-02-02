const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  testEnvironment: "node",
  rootDir: "./__tests__",
  preset: "ts-jest",
  testMatch: ["**/__tests__/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/setupTests.ts"],
  moduleNameMapper: {
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
  },
};
