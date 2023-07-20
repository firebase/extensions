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
  testMatch: [
    "<rootDir>/src/__tests__/bigquery/*.test.ts",
    "<rootDir>/src/__tests__/schema-loader-utils/*.test.ts",
  ],
  moduleNameMapper: {
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
  },
};
