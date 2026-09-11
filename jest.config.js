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
