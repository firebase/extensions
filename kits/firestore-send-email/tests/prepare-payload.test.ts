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

import { describe, expect, test, vi } from "vitest";
import type { ResolvedSendEmailConfig } from "../src/export-config";
import { preparePayload } from "../src/prepare-payload";
import type { Templates } from "../src/templates";
import type { QueuePayload } from "../src/types";

const baseConfig: ResolvedSendEmailConfig = {
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
  usersCollection: "users",
};

describe("preparePayload", () => {
  test("resolves uid recipients through the users collection", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: (id: string) => ({ id }),
      })),
      getAll: vi.fn(async (...args: any[]) => {
        const docs = args.slice(0, -1);
        return docs.map((doc: any) => ({
          id: doc.id,
          exists: true,
          get: () => `${doc.id}@example.com`,
        }));
      }),
    } as any;

    const result = await preparePayload(
      {
        toUids: ["alice"],
        ccUids: ["bob"],
        bcc: "carol@example.com",
        message: { subject: "Hello", text: "World" },
      },
      {
        db,
        config: baseConfig,
      }
    );

    expect(result.to).toEqual(["alice@example.com"]);
    expect(result.cc).toEqual(["bob@example.com"]);
    expect(result.bcc).toEqual(["carol@example.com"]);
  });

  test("preserves inherited empty uid array getAll failure", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: (id: string) => ({ id }),
      })),
      getAll: vi.fn(async (...args: any[]) => {
        const docs = args.slice(0, -1);
        if (docs.length === 0) {
          throw new Error("Expected at least one document ref.");
        }
        return [];
      }),
    } as any;

    await expect(
      preparePayload(
        {
          to: "recipient@example.com",
          toUids: [],
          message: { subject: "Hello", text: "World" },
        },
        {
          db,
          config: baseConfig,
        }
      )
    ).rejects.toThrow("Expected at least one document ref.");
    expect(db.getAll).toHaveBeenCalledOnce();
  });
});

const templateRenders: Record<string, Record<string, unknown>> = {
  "html-only-template": {
    html: "<h1>Template HTML</h1>",
    subject: "Template Subject",
  },
  "text-only-template": {
    text: "Template text content",
    subject: "Template Subject",
  },
  "both-html-text-template": {
    html: "<h1>Template HTML</h1>",
    text: "Template text content",
    subject: "Template Subject",
  },
  "template-with-attachments": {
    html: "<h1>Template HTML</h1>",
    subject: "Template Subject",
    attachments: [{ filename: "template.pdf" }],
  },
  "template-with-null-values": {
    html: null,
    text: null,
    subject: "Template Subject",
  },
  "template-with-empty-strings": {
    html: "",
    text: "",
    subject: "Template Subject",
  },
  "template-with-undefined-values": {
    html: undefined,
    text: undefined,
    subject: "Template Subject",
  },
};

const templates = {
  render: vi.fn(async (name: string, data: Record<string, unknown>) => {
    if (name === "template-with-data") {
      return {
        html: `<h1>Hello ${data.name}</h1>`,
        subject: `Subject for ${data.name}`,
      };
    }
    return templateRenders[name] ?? {};
  }),
} as unknown as Templates;

/** Runs preparePayload against a stub Firestore and the template renders above. */
function prepare(payload: unknown) {
  const db = { getAll: vi.fn() } as any;
  return preparePayload(payload as QueuePayload, {
    db,
    config: baseConfig,
    templates,
  });
}

describe("preparePayload template merging", () => {
  test("rejects a payload with neither message nor template", async () => {
    await expect(prepare({ to: "test@example.com" })).rejects.toThrow(
      "Invalid email configuration: Email configuration must include either a 'message', 'template', or 'sendGrid' object"
    );
  });

  test("takes text and subject from a text-only template", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "text-only-template", data: {} },
    });

    expect(result.message.text).toBe("Template text content");
    expect(result.message.html).toBeUndefined();
    expect(result.message.subject).toBe("Template Subject");
  });

  test("preserves message html when the template only provides text", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "text-only-template", data: {} },
      message: {
        html: "<p>Original HTML content</p>",
        subject: "Original Subject",
      },
    });

    expect(result.message.html).toBe("<p>Original HTML content</p>");
    expect(result.message.text).toBe("Template text content");
    expect(result.message.subject).toBe("Template Subject");
  });

  test("template html and text both win over message text", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "both-html-text-template", data: {} },
      message: { text: "Original text content" },
    });

    expect(result.message.html).toBe("<h1>Template HTML</h1>");
    expect(result.message.text).toBe("Template text content");
  });

  test("template attachments replace message attachments", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-attachments", data: {} },
      message: { attachments: [{ filename: "original.doc" }] },
    });

    expect(result.message.attachments).toEqual([{ filename: "template.pdf" }]);
  });

  test("a template that renders nothing leaves the message intact", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "empty-template", data: {} },
      message: {
        html: "<p>Original HTML content</p>",
        subject: "Original Subject",
      },
    });

    expect(result.message.html).toBe("<p>Original HTML content</p>");
    expect(result.message.subject).toBe("Original Subject");
    expect(result.message.attachments).toEqual([]);
  });

  test("merges template html over message text and subject", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "html-only-template", data: {} },
      message: { text: "Original text content", subject: "Original Subject" },
      attachments: [{ filename: "original.doc" }],
    });

    expect(result.message.html).toBe("<h1>Template HTML</h1>");
    expect(result.message.text).toBe("Original text content");
    expect(result.message.subject).toBe("Template Subject");
  });

  test("passes template data through to the render", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-data", data: { name: "John" } },
    });

    expect(result.message.html).toBe("<h1>Hello John</h1>");
    expect(result.message.subject).toBe("Subject for John");
  });

  test("wraps string recipient addresses in arrays", async () => {
    const result = await prepare({
      to: "test@example.com",
      cc: "cc@example.com",
      bcc: "bcc@example.com",
      message: { subject: "Test Subject", html: "<p>Test HTML content</p>" },
    });

    expect(result.to).toEqual(["test@example.com"]);
    expect(result.cc).toEqual(["cc@example.com"]);
    expect(result.bcc).toEqual(["bcc@example.com"]);
  });

  test("keeps array recipient addresses as-is", async () => {
    const result = await prepare({
      to: ["test1@example.com", "test2@example.com"],
      cc: ["cc1@example.com", "cc2@example.com"],
      bcc: ["bcc1@example.com", "bcc2@example.com"],
      message: { subject: "Test Subject", html: "<p>Test HTML content</p>" },
    });

    expect(result.to).toEqual(["test1@example.com", "test2@example.com"]);
    expect(result.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
    expect(result.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  test("leaves a message without a template untouched", async () => {
    const result = await prepare({
      to: "test@example.com",
      message: {
        html: "<p>Direct HTML content</p>",
        subject: "Direct Subject",
      },
    });

    expect(result.message.html).toBe("<p>Direct HTML content</p>");
    expect(result.message.subject).toBe("Direct Subject");
  });

  test("accepts an empty message object", async () => {
    const result = await prepare({ to: "test@example.com", message: {} });

    expect(result.message).toEqual({});
  });

  test("omits null template values entirely", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-null-values", data: {} },
    });

    expect(result.message.subject).toBe("Template Subject");
    expect("html" in result.message).toBe(false);
    expect("text" in result.message).toBe(false);
  });

  test("null template values do not overwrite message content", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-null-values", data: {} },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    });

    expect(result.message.html).toBe("<p>Original HTML</p>");
    expect(result.message.text).toBe("Original text");
    expect(result.message.subject).toBe("Template Subject");
  });

  test("empty string template values overwrite message content", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-empty-strings", data: {} },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    });

    expect(result.message.html).toBe("");
    expect(result.message.text).toBe("");
    expect(result.message.subject).toBe("Template Subject");
  });

  test("undefined template values do not overwrite message content", async () => {
    const result = await prepare({
      to: "test@example.com",
      template: { name: "template-with-undefined-values", data: {} },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    });

    expect(result.message.html).toBe("<p>Original HTML</p>");
    expect(result.message.text).toBe("Original text");
    expect(result.message.subject).toBe("Template Subject");
  });

  test("strips attachment entries that carry no recognised keys", async () => {
    const result = await prepare({
      to: "tester@gmx.at",
      template: {
        name: "med_order_reply_greimel",
        data: {
          address: "Halbenrain 140 Graz",
          doctorName: "Dr. Andreas",
          openingHours: "Mo., Mi., Fr. 8:00-12:00Di., Do. 10:30-15:30",
          orderText: "Some stuff i need",
          userName: "Pfeiler ",
          name: "med_order_reply_greimel",
        },
      },
      message: {
        attachments: [{ html: null, text: null }],
        subject: "Bestellbestätigung",
      },
    });

    expect(result.message.attachments).toEqual([]);
    expect(result.message.subject).toBe("Bestellbestätigung");
    expect(result.to).toEqual(["tester@gmx.at"]);
  });

  describe("attachment validation", () => {
    test("rejects non-array attachments", async () => {
      await expect(
        prepare({
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test text",
            attachments: "not-an-array",
          },
        })
      ).rejects.toThrow();
    });

    test("rejects null attachments", async () => {
      await expect(
        prepare({
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test text",
            attachments: null,
          },
        })
      ).rejects.toThrow();
    });

    test("accepts undefined attachments", async () => {
      const result = await prepare({
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: undefined,
        },
      });

      expect(result.message.attachments).toBeUndefined();
    });

    test("accepts an empty attachments array", async () => {
      const result = await prepare({
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: [],
        },
      });

      expect(result.message.attachments).toEqual([]);
    });
  });
});
