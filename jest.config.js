module.exports = {
  projects: [
    "<rootDir>/*/jest.config.js",
    "<rootDir>/*/functions/jest.config.js",
  ],
  testPathIgnorePatterns: [
    ".*/bin/",
    ".*/lib/",
    // ignore until existing tests migrated
    ".*/firestore-bigquery-export/",
    ".*/firestore-counter/",
    // Ignoring otherwise tests duplicate due to Jest `projects`
    ".*/__tests__/.*.ts",
  ],
  preset: "ts-jest",

  testEnvironment: "node",
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/node_modules/**",
    "!**/exts-test-data/**",
  ],
  maxConcurrency: 10,
};
