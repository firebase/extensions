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

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/events");
vi.mock("../src/logs");

import * as events from "../src/events";
import { type HandlerContext, handleQueueDoc } from "../src/handlers";

function makeChange(payload: any, overrides: Partial<any> = {}) {
  const ref = overrides.ref || { path: "mail/doc1", get: vi.fn() };
  const before = {
    exists: false,
    data: () => undefined,
    id: "doc1",
    ref,
  };
  const after = {
    exists: true,
    data: () => payload,
    id: "doc1",
    ref,
  };
  return {
    before,
    after,
  };
}

function makeCtx(
  changePayload: any,
  snapshotPayload = changePayload
): HandlerContext & { __ref: any } {
  const refState = {
    payload: structuredClone(snapshotPayload),
  };
  const ref = {
    path: "mail/doc1",
    get: vi.fn(async () => ({
      exists: true,
      data: () => refState.payload,
      ref,
    })),
  } as any;
  const transaction = {
    get: vi.fn(async () => ({
      exists: true,
      data: () => refState.payload,
    })),
    update: vi.fn((_ref: any, update: Record<string, any>) => {
      if (update.delivery) {
        refState.payload.delivery = update.delivery;
      }
      if (update["delivery.state"]) {
        refState.payload.delivery = {
          ...(refState.payload.delivery || {}),
          state: update["delivery.state"],
          leaseExpireTime:
            update["delivery.leaseExpireTime"] ||
            refState.payload.delivery?.leaseExpireTime,
        };
      }
      if (update["delivery.info"]) {
        refState.payload.delivery = {
          ...(refState.payload.delivery || {}),
          state: update["delivery.state"] || refState.payload.delivery?.state,
          info: update["delivery.info"],
        };
      }
      if (update["delivery.error"] !== undefined) {
        refState.payload.delivery = {
          ...(refState.payload.delivery || {}),
          error: update["delivery.error"],
        };
      }
    }),
  };
  const db = {
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return {
    db,
    transport: {
      sendMail: vi.fn(async () => ({
        messageId: "msg-1",
        accepted: ["to@example.com"],
        rejected: [],
        pending: [],
        response: "250 ok",
      })),
    } as any,
    config: {
      databaseId: "(default)",
      databaseRegion: "us-central1",
      mailCollection: "mail",
      defaultFrom: "sender@example.com",
      testing: false,
      ttlExpireType: "never",
      ttlExpireValue: 1,
      tlsOptions: "{}",
      oauthSecure: true,
      authType: "UsernamePassword" as any,
    },
    __ref: ref,
  };
}

describe("handleQueueDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initializes delivery state on first write", async () => {
    const payload = {
      to: ["to@example.com"],
      message: { subject: "Hello", text: "Body" },
    };
    const ctx = makeCtx(payload);
    await handleQueueDoc(
      { data: makeChange(payload, { ref: ctx.__ref }) },
      ctx
    );

    expect(events.recordStartEvent).toHaveBeenCalledTimes(1);
    expect((ctx.db.runTransaction as any).mock.calls.length).toBeGreaterThan(0);
  });

  test("transitions processing delivery to success after sendMail", async () => {
    const snapshotPayload = {
      to: ["to@example.com"],
      message: { subject: "Hello", text: "Body" },
      delivery: {
        state: "PENDING",
        attempts: 0,
      },
    };
    const ctx = makeCtx(snapshotPayload, snapshotPayload);

    await handleQueueDoc(
      { data: makeChange(snapshotPayload, { ref: ctx.__ref }) },
      ctx
    );

    expect(ctx.transport.sendMail).toHaveBeenCalledTimes(1);
    expect(events.recordPendingEvent).toHaveBeenCalledTimes(1);
    expect(events.recordCompleteEvent).toHaveBeenCalledTimes(1);
  });

  test("marks delivery as error when transport.sendMail throws", async () => {
    const snapshotPayload = {
      to: ["to@example.com"],
      message: { subject: "Hello", text: "Body" },
      delivery: {
        state: "PENDING",
        attempts: 0,
      },
    };
    const ctx = makeCtx(snapshotPayload, snapshotPayload);
    (ctx.transport.sendMail as any).mockRejectedValueOnce(
      new Error("smtp down")
    );

    await handleQueueDoc(
      { data: makeChange(snapshotPayload, { ref: ctx.__ref }) },
      ctx
    );

    expect(ctx.transport.sendMail).toHaveBeenCalledTimes(1);
    expect(events.recordCompleteEvent).toHaveBeenCalledTimes(1);
  });
});
