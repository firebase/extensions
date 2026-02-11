// Mock the config module before importing prepare-payload
jest.mock("../src/config", () => ({
  default: {
    usersCollection: "users",
  },
  __esModule: true,
}));

import { preparePayload, setDependencies } from "../src/prepare-payload";

class MockTemplates {
  async render(name: string, data: any) {
    switch (name) {
      case "html-only-template":
        return {
          html: "<h1>Template HTML</h1>",
          subject: "Template Subject",
        };
      case "text-only-template":
        return {
          text: "Template text content",
          subject: "Template Subject",
        };
      case "both-html-text-template":
        return {
          html: "<h1>Template HTML</h1>",
          text: "Template text content",
          subject: "Template Subject",
        };
      case "template-with-attachments":
        return {
          html: "<h1>Template HTML</h1>",
          subject: "Template Subject",
          attachments: [{ filename: "template.pdf" }],
        };
      case "template-with-data":
        return {
          html: `<h1>Hello ${data.name}</h1>`,
          subject: `Subject for ${data.name}`,
        };
      case "template-with-null-values":
        return {
          html: null,
          text: null,
          subject: "Template Subject",
        };
      case "template-with-empty-strings":
        return {
          html: "",
          text: "",
          subject: "Template Subject",
        };
      case "template-with-undefined-values":
        return {
          html: undefined,
          text: undefined,
          subject: "Template Subject",
        };
      case "template-with-object-attachments":
        return {
          html: "<h1>Template HTML</h1>",
          subject: "Template Subject",
          attachments: { filename: "bad.pdf", content: "test" },
        };
      default:
        return {};
    }
  }
}

describe("preparePayload Template Merging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // We stub db.getAll here but it won't be called unless toUids/ccUids/bccUids are used
    setDependencies({ getAll: jest.fn() }, new MockTemplates());
  });

  it("should throw error when there is no message and no template", async () => {
    const payload = {
      to: "test@example.com",
    };

    await expect(preparePayload(payload)).rejects.toThrow(
      "Invalid email configuration: Email configuration must include either a 'message', 'template', or 'sendGrid' object"
    );
  });

  it("should", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "text-only-template",
        data: {},
      },
    };

    const result = await preparePayload(payload);

    console.log(result);

    expect(result.message.text).toBe("Template text content");
    expect(result.message.html).toBeUndefined();
    expect(result.message.subject).toBe("Template Subject");
  });

  it("should preserve existing HTML content when template only provides text", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "text-only-template",
        data: {},
      },
      message: {
        html: "<p>Original HTML content</p>",
        subject: "Original Subject",
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<p>Original HTML content</p>"); // Should preserve original HTML
    expect(result.message.text).toBe("Template text content");
    expect(result.message.subject).toBe("Template Subject");
  });

  it("should prioritize template HTML over message text when both exist", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "both-html-text-template",
        data: {},
      },
      message: {
        text: "Original text content",
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<h1>Template HTML</h1>");
    expect(result.message.text).toBe("Template text content");
  });

  it("should handle attachment merging correctly", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-attachments",
        data: {},
      },
      message: {
        attachments: [{ filename: "original.doc" }],
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.attachments).toEqual([{ filename: "template.pdf" }]);
  });

  it("should throw formatted error when template returns object attachments (not array)", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-object-attachments",
        data: {},
      },
    };

    await expect(preparePayload(payload)).rejects.toThrow(
      "Field 'message.attachments' must be an array"
    );
  });

  it("should gracefully handle template with no content", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "empty-template",
        data: {},
      },
      message: {
        html: "<p>Original HTML content</p>",
        subject: "Original Subject",
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<p>Original HTML content</p>");
    expect(result.message.subject).toBe("Original Subject");
    expect(result.message.attachments).toEqual([]);
  });

  it("should merge template and message content correctly", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "html-only-template",
        data: {},
      },
      message: {
        text: "Original text content",
        subject: "Original Subject",
      },
      attachments: [{ filename: "original.doc" }],
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<h1>Template HTML</h1>");
    expect(result.message.text).toBe("Original text content"); // Should preserve original text
    expect(result.message.subject).toBe("Template Subject");
  });

  it("should handle template data correctly", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-data",
        data: { name: "John" },
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<h1>Hello John</h1>");
    expect(result.message.subject).toBe("Subject for John");
  });

  it("should handle string recipient addresses", async () => {
    const payload = {
      to: "test@example.com",
      cc: "cc@example.com",
      bcc: "bcc@example.com",
      message: {
        subject: "Test Subject",
        html: "<p>Test HTML content</p>",
      },
    };

    const result = await preparePayload(payload);

    expect(result.to).toEqual(["test@example.com"]);
    expect(result.cc).toEqual(["cc@example.com"]);
    expect(result.bcc).toEqual(["bcc@example.com"]);
  });

  it("should handle array recipient addresses", async () => {
    const payload = {
      to: ["test1@example.com", "test2@example.com"],
      cc: ["cc1@example.com", "cc2@example.com"],
      bcc: ["bcc1@example.com", "bcc2@example.com"],
      message: {
        subject: "Test Subject",
        html: "<p>Test HTML content</p>",
      },
    };

    const result = await preparePayload(payload);

    expect(result.to).toEqual(["test1@example.com", "test2@example.com"]);
    expect(result.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
    expect(result.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  it("should handle message without template", async () => {
    const payload = {
      to: "test@example.com",
      message: {
        html: "<p>Direct HTML content</p>",
        subject: "Direct Subject",
      },
    };

    const result = await preparePayload(payload);

    expect(result.message.html).toBe("<p>Direct HTML content</p>");
    expect(result.message.subject).toBe("Direct Subject");
  });

  it("should reject empty message object without template or sendGrid", async () => {
    const payload = {
      to: "test@example.com",
      message: {},
    };

    // Empty message fails on subject requirement first
    await expect(preparePayload(payload)).rejects.toThrow(
      "Invalid message configuration"
    );
  });

  it("should handle template with null values", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-null-values",
        data: {},
      },
    };

    const result = await preparePayload(payload);

    // Changed: null values should be omitted entirely
    expect(result.message.html).toBeUndefined();
    expect(result.message.text).toBeUndefined();
    expect(result.message.subject).toBe("Template Subject");
    // Verify properties don't exist at all
    expect("html" in result.message).toBe(false);
    expect("text" in result.message).toBe(false);
  });

  // NEW TEST: Test for null values not overwriting existing content
  it("should not overwrite existing content when template has null values", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-null-values",
        data: {},
      },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    };

    const result = await preparePayload(payload);

    // null values should not overwrite existing content - they should be omitted
    expect(result.message.html).toBe("<p>Original HTML</p>");
    expect(result.message.text).toBe("Original text");
    expect(result.message.subject).toBe("Template Subject");
  });

  // NEW TEST: Test for empty string values being preserved
  it("should preserve empty string values from template", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-empty-strings",
        data: {},
      },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    };

    const result = await preparePayload(payload);

    // Empty strings should overwrite existing content
    expect(result.message.html).toBe("");
    expect(result.message.text).toBe("");
    expect(result.message.subject).toBe("Template Subject");
  });

  // NEW TEST: Test for undefined values preserving existing content
  it("should preserve existing content when template has undefined values", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "template-with-undefined-values",
        data: {},
      },
      message: {
        html: "<p>Original HTML</p>",
        text: "Original text",
        subject: "Original Subject",
      },
    };

    const result = await preparePayload(payload);

    // undefined values should preserve existing content
    expect(result.message.html).toBe("<p>Original HTML</p>");
    expect(result.message.text).toBe("Original text");
    expect(result.message.subject).toBe("Template Subject");
  });

  it("should handle incorrectly formatted attachments object", async () => {
    const payload = {
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
        attachments: [
          {
            html: null,
            text: null,
          },
        ],
        subject: "Bestellbestätigung",
      },
    };

    const result = await preparePayload(payload);

    // Should convert attachments to an empty array since the format is incorrect
    expect(result.message.attachments).toEqual([]);
    expect(result.message.subject).toBe("Bestellbestätigung");
    expect(result.to).toEqual(["tester@gmx.at"]);
  });

  describe("attachment validation", () => {
    it("should handle non-array attachments", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: "not-an-array",
        },
      };

      await expect(preparePayload(payload)).rejects.toThrow();
    });

    it("should handle null attachments", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: null,
        },
      };

      await expect(preparePayload(payload)).rejects.toThrow();
    });

    it("should handle undefined attachments", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: undefined,
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toBeUndefined();
    });

    it("should handle empty attachments array", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: [],
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toEqual([]);
    });
  });
});

describe("preparePayload", () => {
  it("should throw error attachments object not in an array", async () => {
    const payload = {
      to: "test@example.com",
      message: {
        subject: "Test Subject",
        text: "Test text",
        attachments: {
          filename: "test.txt",
          content: "test",
        },
      },
    };

    await expect(preparePayload(payload)).rejects.toThrow(
      "Invalid message configuration: Field 'message.attachments' must be an array"
    );
  });
});

describe("preparePayload UID resolution", () => {
  const createMockDocSnapshot = (
    id: string,
    email: string | null,
    exists: boolean = true
  ) => ({
    id,
    exists,
    get: (field: string) => (field === "email" ? email : undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should resolve UIDs to emails successfully", async () => {
    const mockGetAll = jest
      .fn()
      .mockResolvedValue([
        createMockDocSnapshot("uid1", "user1@example.com"),
        createMockDocSnapshot("uid2", "user2@example.com"),
      ]);

    const mockDb = {
      getAll: mockGetAll,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockImplementation((uid) => ({ id: uid })),
      }),
    };

    setDependencies(mockDb, null);

    const payload = {
      toUids: ["uid1", "uid2"],
      message: {
        subject: "Test Subject",
        text: "Test text",
      },
    };

    const result = await preparePayload(payload);

    expect(result.to).toContain("user1@example.com");
    expect(result.to).toContain("user2@example.com");
  });

  it("should handle mixed valid and invalid UIDs", async () => {
    const mockGetAll = jest.fn().mockResolvedValue([
      createMockDocSnapshot("uid1", "user1@example.com"),
      createMockDocSnapshot("uid2", null), // User exists but no email
      createMockDocSnapshot("uid3", "user3@example.com"),
      createMockDocSnapshot("uid4", null, false), // User doesn't exist
    ]);

    const mockDb = {
      getAll: mockGetAll,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockImplementation((uid) => ({ id: uid })),
      }),
    };

    setDependencies(mockDb, null);

    const payload = {
      toUids: ["uid1", "uid2", "uid3", "uid4"],
      message: {
        subject: "Test Subject",
        text: "Test text",
      },
    };

    const result = await preparePayload(payload);

    // Only valid emails should be included
    expect(result.to).toEqual(["user1@example.com", "user3@example.com"]);
  });

  it("should handle all UIDs failing to resolve", async () => {
    const mockGetAll = jest
      .fn()
      .mockResolvedValue([
        createMockDocSnapshot("uid1", null, false),
        createMockDocSnapshot("uid2", null, false),
      ]);

    const mockDb = {
      getAll: mockGetAll,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockImplementation((uid) => ({ id: uid })),
      }),
    };

    setDependencies(mockDb, null);

    const payload = {
      toUids: ["uid1", "uid2"],
      message: {
        subject: "Test Subject",
        text: "Test text",
      },
    };

    const result = await preparePayload(payload);

    // No emails resolved, so to should be empty
    expect(result.to).toEqual([]);
  });

  it("should resolve UIDs across to, cc, and bcc", async () => {
    const mockGetAll = jest
      .fn()
      .mockResolvedValue([
        createMockDocSnapshot("uid1", "to@example.com"),
        createMockDocSnapshot("uid2", "cc@example.com"),
        createMockDocSnapshot("uid3", "bcc@example.com"),
      ]);

    const mockDb = {
      getAll: mockGetAll,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockImplementation((uid) => ({ id: uid })),
      }),
    };

    setDependencies(mockDb, null);

    const payload = {
      toUids: ["uid1"],
      ccUids: ["uid2"],
      bccUids: ["uid3"],
      message: {
        subject: "Test Subject",
        text: "Test text",
      },
    };

    const result = await preparePayload(payload);

    expect(result.to).toEqual(["to@example.com"]);
    expect(result.cc).toEqual(["cc@example.com"]);
    expect(result.bcc).toEqual(["bcc@example.com"]);
  });

  it("should combine direct emails with resolved UIDs", async () => {
    const mockGetAll = jest
      .fn()
      .mockResolvedValue([
        createMockDocSnapshot("uid1", "resolved@example.com"),
      ]);

    const mockDb = {
      getAll: mockGetAll,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockImplementation((uid) => ({ id: uid })),
      }),
    };

    setDependencies(mockDb, null);

    const payload = {
      to: "direct@example.com",
      toUids: ["uid1"],
      message: {
        subject: "Test Subject",
        text: "Test text",
      },
    };

    const result = await preparePayload(payload);

    expect(result.to).toEqual(["direct@example.com", "resolved@example.com"]);
  });
});
