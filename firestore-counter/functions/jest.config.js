module.exports = {
  rootDir: "./",
  preset: "ts-jest",
  testMatch: ["**/__tests__/*.test.ts"],
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/__tests__/tsconfig.json",
    },
  },
  testEnvironment: "node",
  testPathIgnorePatterns: ["e2e"],
};
