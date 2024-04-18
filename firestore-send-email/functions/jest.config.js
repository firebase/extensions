const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/__tests__/tsconfig.json",
    },
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  setupFiles: ["<rootDir>/__tests__/jest.setup.ts"],
  testMatch: ["**/__tests__/*.test.ts"],
  testEnvironment: "node",
  moduleNameMapper: {
    "firebase-admin/app": "<rootDir>/node_modules/firebase-admin/lib/app",
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-admin/database":
      "<rootDir>/node_modules/firebase-admin/lib/database",
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
    "firebase-functions/encoder":
      "<rootDir>/node_modules/firebase-functions/lib/encoder",
    "firebase-admin/database":
      "<rootDir>/node_modules/firebase-admin/lib/database",
    "firebase-functions/lib/encoder":
      "<rootDir>/node_modules/firebase-functions-test/lib/providers/firestore.js",
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-functions/lib/v1/providers/firestore.js",
  },
};
