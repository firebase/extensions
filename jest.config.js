module.exports = {
  projects: [
    "<rootDir>/*/jest.config.js",
    "<rootDir>/*/functions/jest.config.js",
    "<rootDir>/firestore-bigquery-export/scripts/*/jest.config.js",
  ],
  testPathIgnorePatterns: [
    ".*/bin/",
    ".*/lib/",
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
