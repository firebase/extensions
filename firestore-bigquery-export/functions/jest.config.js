/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */

const packageJson = require("./package.json");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: "./",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  preset: "ts-jest",
  testEnvironment: "node",
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },
  setupFiles: ["<rootDir>/__tests__/jest.setup.ts"],
  testMatch: ["**/__tests__/*.test.ts"],
  testPathIgnorePatterns: process.env.CI_TEST === "true" ? ["e2e"] : [],
  moduleNameMapper: {
    "firebase-admin/eventarc":
      "<rootDir>/node_modules/firebase-admin/lib/eventarc",
    "firebase-admin/firestore":
      "<rootDir>/node_modules/firebase-admin/lib/firestore",
    "firebase-functions/v2": "<rootDir>/node_modules/firebase-functions/lib/v2",
    "firebase-admin/auth": "<rootDir>/node_modules/firebase-admin/lib/auth",
    "firebase-admin/app": "<rootDir>/node_modules/firebase-admin/lib/app",
    "firebase-admin/database":
      "<rootDir>/node_modules/firebase-admin/lib/database",
    "firebase-admin/functions":
      "<rootDir>/node_modules/firebase-admin/lib/functions",
    "firebase-admin/extensions":
      "<rootDir>/node_modules/firebase-admin/lib/extensions",
  },
};
