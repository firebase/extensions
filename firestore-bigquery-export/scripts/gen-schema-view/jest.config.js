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
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/src/__tests__/**/*.test.ts",
    "<rootDir>/src/__tests__/schema-loader-utils/*.test.ts",
  ],
  testPathIgnorePatterns: process.env.CI_TEST === "true" ? ["e2e"] : [],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-functions/v2": "<rootDir>/node_modules/firebase-functions/lib/v2",
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
    "firebase-admin/app": "<rootDir>/node_modules/firebase-admin/lib/app",
    "firebase-admin/database":
      "<rootDir>/node_modules/firebase-admin/lib/database",
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
  },
};
