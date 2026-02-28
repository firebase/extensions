const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  types: ["jest", "node"],
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/tsconfig.test.json",
    },
  },
  preset: "ts-jest",
  testMatch: ["**/src/__tests__/**/*.test.ts"],
  testEnvironment: "node",
  testTimeout: 180000,
  collectCoverage: true,
  moduleNameMapper: {
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
  },
};
