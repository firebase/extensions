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

const baseConfig = require("./jest.config");

/**
 * CI configuration for the change tracker.
 *
 * The default `jest.config.js` runs every suite, and most of them create real
 * datasets, tables and views in BigQuery (or write to a real Firestore), so
 * they need credentials for a live GCP project and cannot run on a pull
 * request. This config runs only the suites that pass without credentials, so
 * the offline regression coverage for this shared package is visible to CI.
 *
 * Every suite not listed below runs in CI. When you add a suite that needs a
 * live project, add it here.
 */
const liveProjectSuites = [
  "src/__tests__/bigquery/alternativeProject.test.ts",
  "src/__tests__/bigquery/checkUpdates.test.ts",
  "src/__tests__/bigquery/clustering.test.ts",
  "src/__tests__/bigquery/e2e.test.ts",
  "src/__tests__/bigquery/failedTransaction.test.ts",
  "src/__tests__/bigquery/partitioning.test.ts",
  "src/__tests__/bigquery/stresstest.test.ts",
  "src/__tests__/bigquery/wildcardDocument.test.ts",
  "src/__tests__/bigquery/materializedViews/initializeLatestMaterializedView.test.ts",
  "src/__tests__/bigquery/materializedViews/integration.test.ts",
  "src/__tests__/bigquery/materializedViews/shouldRecreateMaterializedView.test.ts",
];

// Jest matches these against absolute paths, which use "\" on Windows, so
// anchor on the separator rather than on rootDir.
const toIgnorePattern = (suite) =>
  "[/\\\\]" + suite.replace(/\./g, "\\.").replace(/\//g, "[/\\\\]") + "$";

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: [
    "/node_modules/",
    ...liveProjectSuites.map(toIgnorePattern),
  ],
};
