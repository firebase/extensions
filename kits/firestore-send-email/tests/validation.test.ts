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

import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ValidationError,
  formatZodError,
  validatePayload,
} from "../src/validation";

describe("validatePayload", () => {
  describe("valid payloads", () => {
    test("accepts a standard message payload", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          message: { subject: "Test Subject", text: "Test message" },
        })
      ).not.toThrow();
    });

    test("accepts a message with HTML content", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          message: { subject: "Test Subject", html: "<p>Test message</p>" },
        })
      ).not.toThrow();
    });

    test("accepts a SendGrid template payload", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: {
            templateId: "d-template-id",
            dynamicTemplateData: { name: "Test User" },
          },
        })
      ).not.toThrow();
    });

    test("accepts a custom template payload", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { name: "Test User" } },
        })
      ).not.toThrow();
    });

    test("accepts multiple recipients", () => {
      expect(() =>
        validatePayload({
          to: ["test1@example.com", "test2@example.com"],
          cc: ["cc1@example.com"],
          bcc: ["bcc1@example.com"],
          message: { subject: "Test Subject", text: "Test message" },
        })
      ).not.toThrow();
    });

    test("accepts UID-based recipients", () => {
      expect(() =>
        validatePayload({
          toUids: ["user1", "user2"],
          ccUids: ["user3"],
          bccUids: ["user4"],
          message: { subject: "Test Subject", text: "Test message" },
        })
      ).not.toThrow();
    });

    test("accepts a payload with optional fields", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          from: "sender@example.com",
          replyTo: "reply@example.com",
          categories: ["category1", "category2"],
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [],
          },
        })
      ).not.toThrow();
    });

    test("accepts a friendly name in the from field", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          from: "Friendly Firebaser test@example.com",
          message: { subject: "Test Subject", text: "Test message" },
        })
      ).not.toThrow();
    });

    test("accepts a template payload without html or text", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { name: "Test User" } },
        })
      ).not.toThrow();
    });

    test("accepts a template payload with a message override", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { name: "Test User" } },
          message: { subject: "Custom Subject", attachments: [] },
        })
      ).not.toThrow();
    });

    test("accepts a template payload with empty data", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email" },
        })
      ).not.toThrow();
    });

    test("accepts a template with a message containing only a subject", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email" },
          message: { subject: "Test Subject" },
        })
      ).not.toThrow();
    });

    test("accepts a template with a message containing optional fields", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { name: "User" } },
          message: {
            subject: "Test Subject",
            attachments: [],
            categories: ["category1"],
          },
        })
      ).not.toThrow();
    });

    test("accepts a template payload when the message has no html or text", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { userName: "John Doe" } },
          message: { subject: "Welcome!" },
        })
      ).not.toThrow();
    });

    test("accepts a template with a completely empty message object", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: { name: "welcome-email", data: { userName: "John Doe" } },
          message: {},
        })
      ).not.toThrow();
    });

    test("accepts a template without a message object", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          template: {
            name: "EGFMB64MzmVz0Or75ctL",
            data: { userName: "cabljac", name: "jacob" },
          },
        })
      ).not.toThrow();
    });

    test("accepts a SendGrid payload with customArgs", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: {
            templateId: "d-template-id",
            customArgs: { campaign: "welcome", source: "signup" },
          },
        })
      ).not.toThrow();
    });

    test("accepts a SendGrid payload with ipPoolName", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: {
            templateId: "d-template-id",
            ipPoolName: "transactional",
          },
        })
      ).not.toThrow();
    });

    test("accepts a SendGrid payload with only mailSettings", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: { mailSettings: { sandboxMode: { enable: true } } },
        })
      ).not.toThrow();
    });
  });

  describe("invalid payloads", () => {
    test("rejects a message without text or html", () => {
      const payload = {
        to: "test@example.com",
        message: { subject: "Test Subject" },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid message configuration: At least one of 'text' or 'html' must be provided in message"
      );
    });

    test("rejects SendGrid dynamicTemplateData without a templateId", () => {
      const payload = {
        to: "test@example.com",
        sendGrid: { dynamicTemplateData: { name: "Test User" } },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid sendGrid configuration: Field 'templateId' is required when 'dynamicTemplateData' is provided"
      );
    });

    test("rejects SendGrid customArgs with non-string values", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: { customArgs: { campaign: 123 } },
        })
      ).toThrow(ValidationError);
    });

    test("rejects a SendGrid ipPoolName that is not a string", () => {
      expect(() =>
        validatePayload({
          to: "test@example.com",
          sendGrid: { ipPoolName: 123 },
        })
      ).toThrow(ValidationError);
    });

    test("rejects a custom template without a name", () => {
      const payload = {
        to: "test@example.com",
        template: { data: { name: "Test User" } },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid template configuration: Field 'template.name' must be a string"
      );
    });

    test("rejects a payload with no recipients", () => {
      const payload = {
        message: { subject: "Test Subject", text: "Test message" },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid email configuration: Email must have at least one recipient"
      );
    });

    test("rejects a recipient field with an invalid type", () => {
      const payload = {
        to: 123,
        message: { subject: "Test Subject", text: "Test message" },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid email configuration: Field 'to' must be either a string or an array of strings"
      );
    });

    test("rejects a payload with no message, template or sendGrid", () => {
      const payload = { to: "test@example.com" };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid email configuration: Email configuration must include either a 'message', 'template', or 'sendGrid' object"
      );
    });

    test("rejects a message without a subject", () => {
      const payload = {
        to: "test@example.com",
        message: { text: "Test message" },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid message configuration: Field 'message.subject' must be a string"
      );
    });

    test("rejects a template with an invalid name type", () => {
      const payload = { to: "test@example.com", template: { name: 123 } };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid template configuration: Field 'template.name' must be a string"
      );
    });

    test("rejects a template that is not a map", () => {
      const payload = { to: "test@example.com", template: 123 };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid template configuration: Field 'template' must be a map"
      );
    });

    test("rejects a template with an invalid data type", () => {
      const payload = {
        to: "test@example.com",
        template: { name: "welcome-email", data: "invalid-data" },
      };
      expect(() => validatePayload(payload)).toThrow(ValidationError);
      expect(() => validatePayload(payload)).toThrow(
        "Invalid template configuration: Field 'template.data' must be a map"
      );
    });
  });

  describe("attachment validation", () => {
    describe("valid attachments", () => {
      test("accepts a plain text attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [{ filename: "hello.txt", content: "Hello world!" }],
            },
          })
        ).not.toThrow();
      });

      test("accepts a binary buffer attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  filename: "buffer.txt",
                  content: Buffer.from("Hello world!", "utf8"),
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts a local file attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  filename: "report.pdf",
                  path: "/absolute/path/to/report.pdf",
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts an attachment with an implicit filename", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [{ path: "/absolute/path/to/image.png" }],
            },
          })
        ).not.toThrow();
      });

      test("accepts an attachment with a custom content type", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  filename: "data.bin",
                  content: Buffer.from("deadbeef", "hex"),
                  contentType: "application/octet-stream",
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts a remote file attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  filename: "license.txt",
                  href: "https://raw.githubusercontent.com/nodemailer/nodemailer/master/LICENSE",
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts a base64 encoded attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  filename: "photo.jpg",
                  content: "/9j/4AAQSkZJRgABAQAAAQABAAD…",
                  encoding: "base64",
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts a data URI attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                { path: "data:text/plain;base64,SGVsbG8gd29ybGQ=" },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts a pre-built MIME node attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                {
                  raw: [
                    "Content-Type: text/plain; charset=utf-8",
                    'Content-Disposition: attachment; filename="greeting.txt"',
                    "",
                    "Hello world!",
                  ].join("\r\n"),
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts an embedded image attachment", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              html: '<p><img src="cid:logo@nodemailer" alt="Nodemailer logo"></p>',
              attachments: [
                {
                  filename: "logo.png",
                  path: "./assets/logo.png",
                  cid: "logo@nodemailer",
                },
              ],
            },
          })
        ).not.toThrow();
      });

      test("accepts multiple attachments", () => {
        expect(() =>
          validatePayload({
            to: "test@example.com",
            message: {
              subject: "Test Subject",
              text: "Test message",
              attachments: [
                { filename: "file1.txt", content: "Content 1" },
                { filename: "file2.txt", content: "Content 2" },
              ],
            },
          })
        ).not.toThrow();
      });
    });

    describe("invalid attachments", () => {
      test("rejects an attachment with an invalid httpHeaders type", () => {
        const payload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                filename: "test.txt",
                href: "https://example.com",
                httpHeaders: "not-an-object",
              },
            ],
          },
        };
        expect(() => validatePayload(payload)).toThrow(ValidationError);
        expect(() => validatePayload(payload)).toThrow(
          "Invalid message configuration: Field 'message.attachments.0.httpHeaders' must be a map"
        );
      });

      test("rejects an attachment with an invalid headers type", () => {
        const payload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                filename: "test.txt",
                content: "test",
                headers: "not-an-object",
              },
            ],
          },
        };
        expect(() => validatePayload(payload)).toThrow(ValidationError);
        expect(() => validatePayload(payload)).toThrow(
          "Invalid message configuration: Field 'message.attachments.0.headers' must be a map"
        );
      });

      test("rejects attachments that are not an array", () => {
        const payload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: { filename: "test.txt", content: "test" },
          },
        };
        expect(() => validatePayload(payload)).toThrow(ValidationError);
        expect(() => validatePayload(payload)).toThrow(
          "Invalid message configuration: Field 'message.attachments' must be an array"
        );
      });
    });
  });
});

function zodErrorFrom(schema: z.ZodSchema, value: unknown): z.ZodError {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error("expected schema to reject value");
  }
  return result.error;
}

describe("formatZodError", () => {
  test("formats invalid_string email issues as a valid email address error", () => {
    const error = zodErrorFrom(z.object({ replyTo: z.string().email() }), {
      replyTo: "not-an-email",
    });
    expect(formatZodError(error)).toBe(
      "Invalid email configuration: Field 'replyTo' must be a valid email address"
    );
  });

  test("formats other invalid_string issues as an invalid field error", () => {
    const error = zodErrorFrom(z.object({ href: z.string().url() }), {
      href: "not-a-url",
    });
    expect(formatZodError(error)).toBe(
      "Invalid email configuration: Field 'href' is invalid"
    );
  });
});
