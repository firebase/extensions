const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  testEnvironment: "node",
  preset: "ts-jest",
  testMatch: ["**/__tests__/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setupTests.ts"],
  moduleNameMapper: {
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
};
