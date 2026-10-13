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

const mockFetch = jest.fn();
jest.mock("node-fetch", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockFetch(...args),
}));

const mockGetIdTokenClient = jest.fn();
jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: mockGetIdTokenClient,
  })),
}));

import { FirestoreBigQueryEventHistoryTracker } from "../../bigquery";
import { ChangeType, FirestoreDocumentChangeEvent } from "../../tracker";

const TRANSFORM_URL = "https://example.com/transform";

function buildEvent(): FirestoreDocumentChangeEvent {
  return {
    timestamp: "2026-05-01T00:00:00.000Z",
    operation: ChangeType.CREATE,
    documentName: "testCollection/d",
    documentId: "d",
    eventId: "e",
    data: { foo: "bar" },
  };
}

function buildTracker(transformFunction: string) {
  const tracker = new FirestoreBigQueryEventHistoryTracker({
    datasetId: "ds",
    datasetLocation: undefined,
    tableId: "t",
    transformFunction,
    partitioning: { granularity: "NONE" },
    clustering: null,
    bqProjectId: null,
    skipInit: true,
  } as any);
  (tracker as any).insertData = jest.fn().mockResolvedValue(undefined);
  return tracker;
}

describe("transformRows", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockGetIdTokenClient.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: [] }),
    });
  });

  it("sends the ID token as X-Serverless-Authorization, not Authorization", async () => {
    mockGetIdTokenClient.mockResolvedValue({
      getRequestHeaders: async () =>
        new Headers({ Authorization: "Bearer test-id-token" }),
    });

    const tracker = buildTracker(TRANSFORM_URL);
    await tracker.record([buildEvent()]);

    expect(mockGetIdTokenClient).toHaveBeenCalledWith(TRANSFORM_URL);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Serverless-Authorization": "Bearer test-id-token",
    });
  });

  it("sends no auth header when the client returns no token", async () => {
    mockGetIdTokenClient.mockResolvedValue({
      getRequestHeaders: async () => new Headers(),
    });

    const tracker = buildTracker(TRANSFORM_URL);
    await tracker.record([buildEvent()]);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("falls back to an unauthenticated call when minting the token fails", async () => {
    mockGetIdTokenClient.mockRejectedValue(new Error("no credentials"));

    const tracker = buildTracker(TRANSFORM_URL);
    await tracker.record([buildEvent()]);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("skips the transform call when no URL is configured", async () => {
    const tracker = buildTracker("");
    await tracker.record([buildEvent()]);

    expect(mockGetIdTokenClient).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when the transform function returns a non-2xx response", async () => {
    mockGetIdTokenClient.mockResolvedValue({
      getRequestHeaders: async () => new Headers(),
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    const tracker = buildTracker(TRANSFORM_URL);
    await expect(tracker.record([buildEvent()])).rejects.toThrow(
      /403.*Forbidden/
    );
  });
});
