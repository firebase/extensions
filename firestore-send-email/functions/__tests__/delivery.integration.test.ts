import { deliverEmail, DeliveryDependencies } from "../src/delivery";
import { setDependencies } from "../src/prepare-payload";

/**
 * Helper to create a mock DocumentReference with the given payload
 */
function createMockRef(payload: any) {
  return {
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => payload,
    }),
    path: "mail/test-doc-id",
  } as any;
}

/**
 * Helper to create a mock DocumentReference that doesn't exist
 */
function createNonExistentRef() {
  return {
    get: jest.fn().mockResolvedValue({
      exists: false,
    }),
    path: "mail/non-existent",
  } as any;
}

describe("deliverEmail integration", () => {
  const mockTransport = {
    sendMail: jest.fn(),
  };

  const deps: DeliveryDependencies = {
    transport: mockTransport as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock dependencies for preparePayload (db and templates)
    setDependencies({ getAll: jest.fn() }, null);

    // Default successful transport response
    mockTransport.sendMail.mockResolvedValue({
      messageId: "test-msg-123",
      accepted: ["user@example.com"],
      rejected: [],
      pending: [],
      response: "250 OK",
    });
  });

  describe("basic delivery scenarios", () => {
    test("delivers email with text content", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test Subject", text: "Plain text content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(result.info?.messageId).toBe("test-msg-123");
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user@example.com"],
          subject: "Test Subject",
          text: "Plain text content",
        })
      );
    });

    test("delivers email with HTML content", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "HTML Email", html: "<h1>Hello</h1><p>World</p>" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<h1>Hello</h1><p>World</p>",
        })
      );
    });

    test("delivers email with both text and HTML content", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "Multi-format Email",
          text: "Plain text version",
          html: "<p>HTML version</p>",
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Plain text version",
          html: "<p>HTML version</p>",
        })
      );
    });

    test("returns delivery info with all fields", async () => {
      mockTransport.sendMail.mockResolvedValue({
        messageId: "unique-id-456",
        queueId: "sendgrid-queue-789",
        accepted: ["a@test.com", "b@test.com"],
        rejected: ["invalid@test.com"],
        pending: ["slow@test.com"],
        response: "250 Message accepted",
      });

      const mockRef = createMockRef({
        to: ["a@test.com", "b@test.com", "invalid@test.com", "slow@test.com"],
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(result.info).toEqual({
        messageId: "unique-id-456",
        sendgridQueueId: "sendgrid-queue-789",
        accepted: ["a@test.com", "b@test.com"],
        rejected: ["invalid@test.com"],
        pending: ["slow@test.com"],
        response: "250 Message accepted",
      });
    });
  });

  describe("recipient handling", () => {
    test("converts single string recipient to array", async () => {
      const mockRef = createMockRef({
        to: "single@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["single@example.com"],
        })
      );
    });

    test("handles array of recipients", async () => {
      const mockRef = createMockRef({
        to: ["user1@example.com", "user2@example.com", "user3@example.com"],
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@example.com", "user2@example.com", "user3@example.com"],
        })
      );
    });

    test("handles all recipient types (to, cc, bcc)", async () => {
      const mockRef = createMockRef({
        to: ["to1@example.com", "to2@example.com"],
        cc: "cc@example.com",
        bcc: ["bcc1@example.com", "bcc2@example.com"],
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["to1@example.com", "to2@example.com"],
          cc: ["cc@example.com"],
          bcc: ["bcc1@example.com", "bcc2@example.com"],
        })
      );
    });

    test("handles cc only (no to)", async () => {
      const mockRef = createMockRef({
        cc: "cc-only@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [],
          cc: ["cc-only@example.com"],
        })
      );
    });

    test("handles bcc only (no to or cc)", async () => {
      const mockRef = createMockRef({
        bcc: ["bcc-only@example.com"],
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [],
          cc: [],
          bcc: ["bcc-only@example.com"],
        })
      );
    });

    test("fails when no recipients at all", async () => {
      const mockRef = createMockRef({
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("delivery state handling", () => {
    test("processes when state is PROCESSING", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(mockTransport.sendMail).toHaveBeenCalled();
    });

    test("skips when state is PENDING", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PENDING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("skips when state is SUCCESS", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "SUCCESS" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("skips when state is ERROR", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "ERROR" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("skips when state is RETRY", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "RETRY" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("skips when delivery object is missing", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        // No delivery object
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("skips when document does not exist", async () => {
      const mockRef = createNonExistentRef();

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.error).toContain("does not exist");
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("SendGrid configuration", () => {
    test("handles SendGrid templateId", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          templateId: "d-abc123def456",
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "d-abc123def456",
        })
      );
    });

    test("handles SendGrid with dynamicTemplateData", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          templateId: "d-template-id",
          dynamicTemplateData: {
            firstName: "John",
            lastName: "Doe",
            orderNumber: 12345,
            items: ["Item A", "Item B"],
          },
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "d-template-id",
          dynamicTemplateData: {
            firstName: "John",
            lastName: "Doe",
            orderNumber: 12345,
            items: ["Item A", "Item B"],
          },
        })
      );
    });

    test("handles SendGrid with mailSettings", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          templateId: "d-template-id",
          mailSettings: {
            sandboxMode: { enable: true },
            bypassListManagement: { enable: false },
          },
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          mailSettings: {
            sandboxMode: { enable: true },
            bypassListManagement: { enable: false },
          },
        })
      );
    });

    test("handles SendGrid with all options combined", async () => {
      const mockRef = createMockRef({
        to: ["user1@example.com", "user2@example.com"],
        cc: "cc@example.com",
        from: "sender@company.com",
        replyTo: "support@company.com",
        sendGrid: {
          templateId: "d-full-template",
          dynamicTemplateData: { name: "Customer" },
          mailSettings: { sandboxMode: { enable: false } },
        },
        categories: ["transactional", "welcome"],
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@example.com", "user2@example.com"],
          cc: ["cc@example.com"],
          from: "sender@company.com",
          replyTo: "support@company.com",
          templateId: "d-full-template",
          dynamicTemplateData: { name: "Customer" },
          mailSettings: { sandboxMode: { enable: false } },
          categories: ["transactional", "welcome"],
        })
      );
    });

    test("handles SendGrid template with message content override", async () => {
      // When both sendGrid.templateId and message content are provided,
      // the message fields should still be passed to allow fallback/override
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          templateId: "d-my-template",
          dynamicTemplateData: { name: "John" },
        },
        message: {
          subject: "Fallback Subject",
          text: "Fallback text if template fails",
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "d-my-template",
          dynamicTemplateData: { name: "John" },
          subject: "Fallback Subject",
          text: "Fallback text if template fails",
        })
      );
    });

    test("handles SendGrid with empty message object", async () => {
      // SendGrid with empty message should still work (template provides content)
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          templateId: "d-template-provides-all",
        },
        message: {},
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "d-template-provides-all",
        })
      );
    });

    test("handles SendGrid mailSettings only (no templateId)", async () => {
      // mailSettings can be used without templateId for sandbox mode etc
      const mockRef = createMockRef({
        to: "user@example.com",
        sendGrid: {
          mailSettings: {
            sandboxMode: { enable: true },
          },
        },
        message: {
          subject: "Test in Sandbox",
          text: "This email is in sandbox mode",
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Test in Sandbox",
          text: "This email is in sandbox mode",
          mailSettings: {
            sandboxMode: { enable: true },
          },
        })
      );
    });
  });

  describe("attachments", () => {
    test("handles message with attachments array", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "Email with attachments",
          text: "See attached files",
          attachments: [
            { filename: "report.pdf", content: "base64content" },
            { filename: "image.png", path: "/path/to/image.png" },
          ],
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            { filename: "report.pdf", content: "base64content" },
            { filename: "image.png", path: "/path/to/image.png" },
          ],
        })
      );
    });

    test("handles message with empty attachments array", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "No attachments",
          text: "Plain email",
          attachments: [],
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
    });

    test("handles attachment with all properties", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "Full attachment",
          text: "Content",
          attachments: [
            {
              filename: "document.pdf",
              content: "base64data",
              contentType: "application/pdf",
              contentDisposition: "attachment",
              cid: "unique-cid",
              encoding: "base64",
            },
          ],
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: "document.pdf",
              contentType: "application/pdf",
            }),
          ]),
        })
      );
    });
  });

  describe("custom email options", () => {
    test("uses custom from address", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        from: "custom-sender@company.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "custom-sender@company.com",
        })
      );
    });

    test("uses custom replyTo address", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        replyTo: "support@company.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "support@company.com",
        })
      );
    });

    test("includes custom headers", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Priority": "1",
        },
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            "X-Custom-Header": "custom-value",
            "X-Priority": "1",
          },
        })
      );
    });

    test("includes categories", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        categories: ["marketing", "newsletter", "weekly"],
        message: { subject: "Newsletter", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ["marketing", "newsletter", "weekly"],
        })
      );
    });
  });

  describe("error handling", () => {
    test("returns error when transport fails with SMTP error", async () => {
      mockTransport.sendMail.mockRejectedValue(
        new Error("SMTP connection refused")
      );

      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.skipped).toBeUndefined();
      expect(result.error).toContain("SMTP connection refused");
    });

    test("returns error when transport times out", async () => {
      mockTransport.sendMail.mockRejectedValue(
        new Error("Connection timed out")
      );

      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    test("returns error when authentication fails", async () => {
      mockTransport.sendMail.mockRejectedValue(
        new Error("Invalid login: 535 Authentication failed")
      );

      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Authentication failed");
    });

    test("returns error for validation failure - missing message and template", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        // No message, template, or sendGrid
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test("returns error for invalid attachments (object instead of array)", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "Test",
          text: "Content",
          attachments: { filename: "bad.pdf" }, // Object, not array
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("array");
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("rejects empty message object without template or sendGrid", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {},
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      // Empty message without template/sendGrid should fail - needs subject + content
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid message configuration");
    });

    test("handles null values in transport response", async () => {
      mockTransport.sendMail.mockResolvedValue({
        messageId: null,
        accepted: null,
        rejected: null,
        pending: null,
        response: null,
      });

      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(result.info).toEqual({
        messageId: null,
        sendgridQueueId: null,
        accepted: [],
        rejected: [],
        pending: [],
        response: null,
      });
    });

    test("handles very long recipient list", async () => {
      const manyRecipients = Array.from(
        { length: 100 },
        (_, i) => `user${i}@example.com`
      );

      const mockRef = createMockRef({
        to: manyRecipients,
        message: { subject: "Mass email", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: manyRecipients,
        })
      );
    });

    test("handles unicode in email content", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: {
          subject: "日本語の件名 🎉",
          text: "Émojis: 👍 🚀 ✨",
          html: "<p>中文内容 with émojis 🌟</p>",
        },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "日本語の件名 🎉",
          text: "Émojis: 👍 🚀 ✨",
          html: "<p>中文内容 with émojis 🌟</p>",
        })
      );
    });

    test("handles special characters in email addresses", async () => {
      const mockRef = createMockRef({
        to: '"John Doe" <john.doe@example.com>',
        from: "Company Name <no-reply@company.com>",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const result = await deliverEmail(mockRef, deps);

      expect(result.success).toBe(true);
    });
  });

  describe("concurrent delivery attempts", () => {
    test("multiple calls with same ref return consistent results", async () => {
      const mockRef = createMockRef({
        to: "user@example.com",
        message: { subject: "Test", text: "Content" },
        delivery: { state: "PROCESSING" },
      });

      const [result1, result2, result3] = await Promise.all([
        deliverEmail(mockRef, deps),
        deliverEmail(mockRef, deps),
        deliverEmail(mockRef, deps),
      ]);

      // All should succeed (though in production, the state machine would prevent duplicates)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(mockTransport.sendMail).toHaveBeenCalledTimes(3);
    });
  });
});
