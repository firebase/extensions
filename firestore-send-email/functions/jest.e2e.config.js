module.exports = {
  displayName: "e2e",
  rootDir: "./",
  preset: "ts-jest",
  testMatch: ["**/__tests__/e2e/**/*.test.ts"],
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/__tests__/e2e/setup.ts"],
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/__tests__/tsconfig.json",
    },
  },
};
