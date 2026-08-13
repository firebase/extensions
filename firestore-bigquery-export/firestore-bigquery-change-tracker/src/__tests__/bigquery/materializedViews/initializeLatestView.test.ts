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

import { initializeLatestView } from "../../../bigquery/initializeLatestView";
import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import { ChangeTrackerConfig } from "../../../bigquery/types";

jest.mock("../../../bigquery/initializeLatestMaterializedView");

describe("initializeLatestView", () => {
  const mockView = {
    id: "test_view",
    getMetadata: jest.fn(),
    setMetadata: jest.fn(),
    create: jest.fn(),
  };

  const mockConfig: ChangeTrackerConfig = {
    datasetId: "test_dataset",
    tableId: "test_raw_table",
    datasetLocation: "US",
    partitioning: {
      granularity: "NONE",
    },
    transformFunction: "",
    clustering: [],
    bqProjectId: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeLatestView", () => {
    it("calls initializeLatestMaterializedView when useMaterializedView is true", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: true },
        useMaterializedView: true,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).toHaveBeenCalled();
    });

    it("does not call initializeLatestMaterializedView when useMaterializedView is false", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: false },
        useMaterializedView: false,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).not.toHaveBeenCalled();
    });
  });
});
