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

vi.mock("@sendgrid/mail", () => ({
  setApiKey: vi.fn(),
  send: vi.fn().mockResolvedValue([
    {
      headers: { "x-message-id": "test-message-id" },
      statusCode: 202,
    },
    {},
  ]),
}));

import * as sgMail from "@sendgrid/mail";
import { SendGridTransport } from "../src/nodemailer-sendgrid";
import type {
  Address,
  AttachmentEntry,
  IcalEvent,
  MailSource,
} from "../src/nodemailer-sendgrid/types";

const setApiKey = vi.mocked(sgMail.setApiKey);
const send = vi.mocked(sgMail.send);

/** Wraps a normalized mail source in the minimal MailSource shape the transport consumes. */
function mailFrom(source: Partial<MailSource>): MailSource {
  return {
    normalize: (cb) => cb(null, source as MailSource),
  } as MailSource;
}

/** Defers to the check phase, after the transport's normalize/send promise chain settles. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function sentMessage(): any {
  return send.mock.calls[0]?.[0];
}

const successInfo = {
  messageId: null,
  queueId: "test-message-id",
  accepted: [] as string[],
  rejected: [],
  pending: [],
  response: "status=202",
};

describe("SendGridTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets the API key when one is provided", () => {
    new SendGridTransport({ apiKey: "API-KEY-123" });
    expect(setApiKey).toHaveBeenCalledWith("API-KEY-123");
  });

  test("does not set an API key when the option is absent", () => {
    new SendGridTransport({});
    expect(setApiKey).not.toHaveBeenCalled();
  });

  test("calls back with the normalize error and never sends", async () => {
    const transport = new SendGridTransport({ apiKey: "X" });
    const normalizeError = new Error("normalize failed");
    const cb = vi.fn();

    transport.send(
      { normalize: (callback) => callback(normalizeError, {} as MailSource) },
      cb
    );
    await flush();

    expect(cb).toHaveBeenCalledWith(normalizeError);
    expect(send).not.toHaveBeenCalled();
  });

  test("maps subject, text and html straight through", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(mailFrom({ subject: "S", text: "T", html: "<p>H</p>" }), cb);
    await flush();

    expect(send).toHaveBeenCalledWith({
      subject: "S",
      text: "T",
      html: "<p>H</p>",
    });
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("maps from and replyTo to single addresses", async () => {
    const transport = new SendGridTransport();
    const address: Address = { name: "Alice", address: "a@x.com" };
    const cb = vi.fn();

    transport.send(mailFrom({ from: address, replyTo: [address] }), cb);
    await flush();

    expect(sentMessage().from).toEqual({ name: "Alice", email: "a@x.com" });
    expect(sentMessage().replyTo).toEqual({ name: "Alice", email: "a@x.com" });
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("maps to, cc and bcc into address arrays", async () => {
    const transport = new SendGridTransport();
    const first: Address = { name: "B", address: "b@x" };
    const second: Address = { name: "C", address: "c@x" };
    const cb = vi.fn();

    transport.send(
      mailFrom({ to: [first], cc: second, bcc: [first, second] }),
      cb
    );
    await flush();

    expect(sentMessage().to).toEqual([{ name: "B", email: "b@x" }]);
    expect(sentMessage().cc).toEqual([{ name: "C", email: "c@x" }]);
    expect(sentMessage().bcc).toEqual([
      { name: "B", email: "b@x" },
      { name: "C", email: "c@x" },
    ]);
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["b@x", "c@x"],
    });
  });

  test("maps attachments with inline and attachment dispositions", async () => {
    const transport = new SendGridTransport();
    const attachments: AttachmentEntry[] = [
      { content: "foo", filename: "f.txt", contentType: "text/plain" },
      {
        content: "img",
        filename: "i.png",
        contentType: "image/png",
        cid: "cid123",
      },
    ];
    const cb = vi.fn();

    transport.send(mailFrom({ attachments }), cb);
    await flush();

    const sent = sentMessage().attachments;
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      content: "foo",
      filename: "f.txt",
      type: "text/plain",
      disposition: "attachment",
    });
    expect(sent[1]).toMatchObject({
      content: "img",
      filename: "i.png",
      type: "image/png",
      disposition: "inline",
      content_id: "cid123",
    });
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("maps alternatives into the content array", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(
      mailFrom({ alternatives: [{ content: "alt", contentType: "text/alt" }] }),
      cb
    );
    await flush();

    expect(sentMessage().content).toEqual([{ type: "text/alt", value: "alt" }]);
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("maps icalEvent to an attachment", async () => {
    const transport = new SendGridTransport();
    const event: IcalEvent = { content: "ics", filename: "evt.ics" };
    const cb = vi.fn();

    transport.send(mailFrom({ icalEvent: event }), cb);
    await flush();

    expect(sentMessage().attachments[0]).toMatchObject({
      content: "ics",
      filename: "evt.ics",
      type: "application/ics",
      disposition: "attachment",
    });
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("maps watchHtml into the content array", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(mailFrom({ watchHtml: "<watch>" }), cb);
    await flush();

    expect(sentMessage().content).toEqual([
      { type: "text/watch-html", value: "<watch>" },
    ]);
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("skips an empty watchHtml instead of emitting a content entry", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(mailFrom({ watchHtml: "" }), cb);
    await flush();

    expect(sentMessage().content).toBeUndefined();
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("merges normalizedHeaders and messageId into headers", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(
      mailFrom({
        normalizedHeaders: { "X-Custom": "val" },
        messageId: "msg-123",
      }),
      cb
    );
    await flush();

    expect(sentMessage().headers).toMatchObject({
      "X-Custom": "val",
      "message-id": "msg-123",
    });
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      messageId: "msg-123",
    });
  });

  test("skips an empty messageId instead of emitting a message-id header", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(
      mailFrom({ normalizedHeaders: { "X-Custom": "val" }, messageId: "" }),
      cb
    );
    await flush();

    expect(sentMessage().headers).toEqual({ "X-Custom": "val" });
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("folds text and html into the content array when alternatives exist", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(
      mailFrom({
        text: "TXT",
        html: "<H>",
        alternatives: [{ content: "alt1", contentType: "type1" }],
      }),
      cb
    );
    await flush();

    expect(sentMessage().content).toEqual([
      { type: "text/html", value: "<H>" },
      { type: "text/plain", value: "TXT" },
      { type: "type1", value: "alt1" },
    ]);
    expect(cb).toHaveBeenCalledWith(null, successInfo);
  });

  test("calls back with the error when the SendGrid send rejects", async () => {
    const transport = new SendGridTransport();
    const sendError = new Error("send failed");
    send.mockRejectedValueOnce(sendError);
    const cb = vi.fn();

    transport.send(mailFrom({ subject: "Hi" }), cb);
    await flush();

    expect(cb).toHaveBeenCalledWith(sendError);
  });

  test("forwards the categories array", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const cb = vi.fn();

    transport.send(
      mailFrom({
        from: { address: "a@x.com" },
        to: [{ address: "b@x.com" }],
        subject: "Category test",
        categories: ["alpha", "beta", "gamma"],
      }),
      cb
    );
    await flush();

    expect(sentMessage().categories).toEqual(["alpha", "beta", "gamma"]);
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["b@x.com"],
    });
  });

  test("forwards templateId and dynamicTemplateData", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const cb = vi.fn();

    transport.send(
      mailFrom({
        from: { address: "from@ex.com" },
        to: [{ address: "to@ex.com" }],
        subject: "Template test",
        templateId: "d-1234567890abcdef",
        dynamicTemplateData: { name: "Jacob", count: 42 },
      }),
      cb
    );
    await flush();

    expect(sentMessage().templateId).toBe("d-1234567890abcdef");
    expect(sentMessage().dynamicTemplateData).toMatchObject({
      name: "Jacob",
      count: 42,
    });
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["to@ex.com"],
    });
  });

  test("forwards the mailSettings object", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const cb = vi.fn();

    transport.send(
      mailFrom({
        from: { address: "a@x.com" },
        to: [{ address: "b@x.com" }],
        subject: "MailSettings test",
        mailSettings: {
          sandboxMode: { enable: true },
          personalization: { enable: false },
        },
      }),
      cb
    );
    await flush();

    expect(sentMessage().mailSettings).toMatchObject({
      sandboxMode: { enable: true },
      personalization: { enable: false },
    });
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["b@x.com"],
    });
  });

  test("forwards the customArgs object", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const cb = vi.fn();

    transport.send(
      mailFrom({
        from: { address: "a@x.com" },
        to: [{ address: "b@x.com" }],
        subject: "Custom args test",
        customArgs: { campaign: "welcome", source: "signup" },
      }),
      cb
    );
    await flush();

    expect(sentMessage().customArgs).toEqual({
      campaign: "welcome",
      source: "signup",
    });
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["b@x.com"],
    });
  });

  test("forwards the ipPoolName string", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const cb = vi.fn();

    transport.send(
      mailFrom({
        from: { address: "a@x.com" },
        to: [{ address: "b@x.com" }],
        subject: "IP pool test",
        ipPoolName: "transactional",
      }),
      cb
    );
    await flush();

    expect(sentMessage().ipPoolName).toBe("transactional");
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: ["b@x.com"],
    });
  });

  test("lowercases and deduplicates accepted recipients across to, cc and bcc", async () => {
    const transport = new SendGridTransport();
    const cb = vi.fn();

    transport.send(
      mailFrom({
        to: [{ address: "User@example.com" }, { address: "user@example.com" }],
        cc: [{ address: "user@example.com" }, { address: "other@example.com" }],
        bcc: [
          { address: "user@example.com" },
          { address: "ANOTHER@example.com" },
        ],
      }),
      cb
    );
    await flush();

    expect(sentMessage().to).toHaveLength(2);
    expect(sentMessage().cc).toHaveLength(2);
    expect(sentMessage().bcc).toHaveLength(2);
    expect(cb).toHaveBeenCalledWith(null, {
      ...successInfo,
      accepted: [
        "user@example.com",
        "other@example.com",
        "another@example.com",
      ],
    });
  });
});
