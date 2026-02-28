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
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns:
    process.env.CI_TEST === "true" ? ["vulnerability"] : [],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-admin/functions":
      "<rootDir>/node_modules/firebase-admin/lib/functions",
    "firebase-admin/extensions":
      "<rootDir>/node_modules/firebase-admin/lib/extensions",
  },
};
