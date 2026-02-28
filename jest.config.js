module.exports = {
  projects: [
    "<rootDir>/*/functions/jest.config.js",
    "<rootDir>/firestore-bigquery-export/scripts/gen-schema-view/jest.config.js",
  ],
  testPathIgnorePatterns: [
    ".*/bin/",
    ".*/lib/",
    ".*/firestore-counter/",
    "/node_modules/",
    // Ignoring otherwise tests duplicate due to Jest `projects`
    ".*/__tests__/.*.ts",
    "<rootDir>/firestore-send-email/functions/__tests__/e2e.test.ts",
  ],
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/node_modules/**",
    "!**/test-data/**",
  ],
  maxConcurrency: 10,
};
