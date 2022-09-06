module.exports = {
  rootDir: "./",
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
    },
  },
  preset: "ts-jest",
  testMatch: ["**/__tests__/*.test.ts"],
};
