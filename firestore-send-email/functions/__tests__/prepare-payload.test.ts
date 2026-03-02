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
      case "template-with-object-attachment":
        // Simulates a template that returns attachments as an object instead of array
        return {
          html: "<h1>Template HTML</h1>",
          subject: "Template Subject",
          attachments: { filename: "report.pdf" },
        };
      case "template-with-null-attachments":
        return {
          html: "<h1>Template HTML</h1>",
          subject: "Template Subject",
          attachments: null,
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

  it("should handle empty message object", async () => {
    const payload = {
      to: "test@example.com",
      message: {},
    };

    const result = await preparePayload(payload);

    expect(result.message).toEqual({});
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

  it("should filter out empty attachment objects with only null values", async () => {
    const payload = {
      to: "test@example.com",
      template: {
        name: "html-only-template",
        data: {
          name: "Test User",
        },
      },
      message: {
        attachments: [
          {
            html: null,
            text: null,
          },
        ],
        subject: "Test Subject",
      },
    };

    const result = await preparePayload(payload);

    // Empty attachment objects should be filtered out
    expect(result.message.attachments).toEqual([]);
    expect(result.message.subject).toBe("Template Subject");
    expect(result.to).toEqual(["test@example.com"]);
  });

  describe("attachment validation", () => {
    it("should throw clear error for string attachments", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: "not-an-array",
        },
      };

      await expect(preparePayload(payload)).rejects.toThrow(
        "Invalid message configuration: Field 'message.attachments' must be an array"
      );
    });

    it("should throw clear error for invalid attachment httpHeaders", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: [
            {
              filename: "test.txt",
              href: "https://example.com",
              httpHeaders: "invalid",
            },
          ],
        },
      };

      await expect(preparePayload(payload)).rejects.toThrow(
        "Invalid message configuration: Field 'message.attachments.0.httpHeaders' must be a map"
      );
    });

    it("should handle null attachments as no attachments", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: null,
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toBeUndefined();
    });

    it("should normalize single attachment object to array", async () => {
      const payload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test text",
          attachments: { filename: "test.txt", content: "test content" },
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toEqual([
        { filename: "test.txt", content: "test content" },
      ]);
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

  describe("template-rendered attachments", () => {
    it("should normalize template-returned attachment object to array", async () => {
      // This tests the exact scenario from issue #2550 where a template
      // returns attachments as an object instead of an array
      const payload = {
        to: "test@example.com",
        template: {
          name: "template-with-object-attachment",
          data: {},
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toEqual([{ filename: "report.pdf" }]);
    });

    it("should handle template-returned null attachments", async () => {
      const payload = {
        to: "test@example.com",
        template: {
          name: "template-with-null-attachments",
          data: {},
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.attachments).toEqual([]);
    });

    it("should process template-only payload without message field", async () => {
      // Matches the user's payload structure - template only, no message field
      const payload = {
        to: "test@example.com",
        template: {
          name: "html-only-template",
          data: {
            someField: "value",
          },
        },
      };

      const result = await preparePayload(payload);
      expect(result.message.html).toBe("<h1>Template HTML</h1>");
      expect(result.message.subject).toBe("Template Subject");
    });
  });
});
