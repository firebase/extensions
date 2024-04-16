const packageJson = require("./package.json");

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/__tests__/tsconfig.json",
    },
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  preset: "ts-jest",
  setupFiles: ["<rootDir>/__tests__/jest.setup.ts"],
  testMatch: ["**/__tests__/unit/translateMultipleBackfill.test.ts"],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
    "firebase-admin/app": "<rootDir>/node_modules/firebase-admin/lib/app",
    "firebase-admin/database":
      "<rootDir>/node_modules/firebase-admin/lib/database",
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
    "firebase-admin/functions":
      "<rootDir>/node_modules/firebase-admin/lib/functions",
    "firebase-functions/v2": "<rootDir>/node_modules/firebase-functions/lib/v2",
    "firebase-admin/extensions":
      "<rootDir>/node_modules/firebase-admin/lib/extensions",
  },
};
