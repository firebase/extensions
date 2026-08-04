/*
 * Copyright 2019 Google LLC
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

import { describe, expect, test, vi } from "vitest";
import { PARTITIONING_FIELD_REMOVAL_ERROR } from "../src/dts";
import type { HandlerContext } from "../src/handlers";
import { handleUpsertTransferConfig } from "../src/handlers";
import { baseConfig, liveTransferConfig, makeFakeFirestore } from "./helpers";

const EXISTING_DOC = {
  id: "642f3a36-0000-2fbb-ad1d-001a114e2fa6",
  data: {
    extInstanceId: baseConfig.instanceId,
    name: liveTransferConfig().name,
  },
};

function makeCtx(
  db: ReturnType<typeof makeFakeFirestore>,
  overrides: Partial<Record<string, unknown>> = {}
): HandlerContext {
  return {
    db,
    config: baseConfig,
    dts: {
      getTransferConfig: vi.fn(async () => [liveTransferConfig()]),
      createTransferConfig: vi.fn(async () => [
        {
          name: "projects/test/locations/us/transferConfigs/new-config-id",
          displayName: baseConfig.displayName,
        },
      ]),
      updateTransferConfig: vi.fn(async () => [liveTransferConfig()]),
    },
    bigquery: {},
    pubsub: { createTopic: vi.fn(async () => []) },
    resolveServiceAccountEmail: async () =>
      "runtime-sa@test.iam.gserviceaccount.com",
    ...overrides,
  } as unknown as HandlerContext;
}

describe("handleUpsertTransferConfig", () => {
  test("creates the notification topic idempotently (swallows ALREADY_EXISTS)", async () => {
    const db = makeFakeFirestore();
    const alreadyExists = Object.assign(new Error("exists"), { code: 6 });
    const ctx = makeCtx(db, {
      pubsub: {
        createTopic: vi.fn(async () => {
          throw alreadyExists;
        }),
      },
    });

    await expect(handleUpsertTransferConfig(ctx)).resolves.toBeUndefined();
    expect(ctx.pubsub.createTopic).toHaveBeenCalledWith(baseConfig.pubsubTopic);
  });

  test("propagates non-ALREADY_EXISTS topic errors", async () => {
    const db = makeFakeFirestore();
    const denied = Object.assign(new Error("permission denied"), { code: 7 });
    const ctx = makeCtx(db, {
      pubsub: {
        createTopic: vi.fn(async () => {
          throw denied;
        }),
      },
    });

    await expect(handleUpsertTransferConfig(ctx)).rejects.toThrow(
      "permission denied"
    );
  });

  test("create path: no existing doc creates DTS config with the resolved SA and mirrors it", async () => {
    const db = makeFakeFirestore();
    const ctx = makeCtx(db);

    await handleUpsertTransferConfig(ctx);

    expect(ctx.dts.createTransferConfig).toHaveBeenCalledTimes(1);
    const [request] = (ctx.dts.createTransferConfig as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(request.transferConfig.serviceAccountName).toBe(
      "runtime-sa@test.iam.gserviceaccount.com"
    );

    const mirrored = db._get("transferConfigs", "new-config-id");
    expect(mirrored).toMatchObject({
      extInstanceId: baseConfig.instanceId,
      name: "projects/test/locations/us/transferConfigs/new-config-id",
    });
  });

  test("create path omits serviceAccountName when lookup returns undefined", async () => {
    const db = makeFakeFirestore();
    const ctx = makeCtx(db, {
      resolveServiceAccountEmail: async () => undefined,
    });

    await handleUpsertTransferConfig(ctx);

    const [request] = (ctx.dts.createTransferConfig as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(request.transferConfig.serviceAccountName).toBeUndefined();
  });

  test("update path: existing doc updates the DTS config and mirrors the refetched result", async () => {
    const db = makeFakeFirestore({ transferConfigs: [EXISTING_DOC] });
    const ctx = makeCtx(db);

    await handleUpsertTransferConfig(ctx);

    expect(ctx.dts.createTransferConfig).not.toHaveBeenCalled();
    expect(ctx.dts.updateTransferConfig).toHaveBeenCalledTimes(1);

    const mirrored = db._get(
      "transferConfigs",
      "642f3a36-0000-2fbb-ad1d-001a114e2fa6"
    );
    expect(mirrored).toMatchObject({
      extInstanceId: baseConfig.instanceId,
      name: liveTransferConfig().name,
    });
  });

  test("update path: missing name field on the doc throws", async () => {
    const db = makeFakeFirestore({
      transferConfigs: [
        { id: "broken", data: { extInstanceId: baseConfig.instanceId } },
      ],
    });

    await expect(handleUpsertTransferConfig(makeCtx(db))).rejects.toThrow(
      "missing required 'name' field"
    );
  });

  test("partitioning-field removal is terminal: resolves without rethrow", async () => {
    const db = makeFakeFirestore({ transferConfigs: [EXISTING_DOC] });
    const ctx = makeCtx(db, {
      dts: {
        getTransferConfig: vi.fn(async () => [liveTransferConfig()]),
        createTransferConfig: vi.fn(),
        updateTransferConfig: vi.fn(async () => {
          throw new Error(PARTITIONING_FIELD_REMOVAL_ERROR);
        }),
      },
    });

    await expect(handleUpsertTransferConfig(ctx)).resolves.toBeUndefined();
    expect(ctx.dts.createTransferConfig).not.toHaveBeenCalled();
  });

  test("other update errors rethrow for task retry", async () => {
    const db = makeFakeFirestore({ transferConfigs: [EXISTING_DOC] });
    const ctx = makeCtx(db, {
      dts: {
        getTransferConfig: vi.fn(async () => [liveTransferConfig()]),
        createTransferConfig: vi.fn(),
        updateTransferConfig: vi.fn(async () => {
          throw new Error("API Error");
        }),
      },
    });

    await expect(handleUpsertTransferConfig(ctx)).rejects.toThrow("API Error");
  });
});
