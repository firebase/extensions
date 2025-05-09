import { validatePayload, ValidationError } from "../src/validation";

describe("validatePayload", () => {
  // Test valid standard message payload
  it("should validate a standard message payload", () => {
    const validPayload = {
      to: "test@example.com",
      message: {
        subject: "Test Subject",
        text: "Test message",
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test valid HTML message
  it("should validate a message with HTML content", () => {
    const validPayload = {
      to: "test@example.com",
      message: {
        subject: "Test Subject",
        html: "<p>Test message</p>",
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test valid SendGrid template
  it("should validate a SendGrid template payload", () => {
    const validPayload = {
      to: "test@example.com",
      sendGrid: {
        templateId: "d-template-id",
        dynamicTemplateData: {
          name: "Test User",
        },
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test valid custom template
  it("should validate a custom template payload", () => {
    const validPayload = {
      to: "test@example.com",
      template: {
        name: "welcome-email",
        data: {
          name: "Test User",
        },
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test invalid message (missing text/html)
  it("should throw ValidationError for message without text or html", () => {
    const invalidPayload = {
      to: "test@example.com",
      message: {
        subject: "Test Subject",
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Invalid email configuration: At least one of 'text' or 'html' must be provided in message"
    );
  });

  // Test invalid SendGrid template (missing templateId)
  it("should throw ValidationError for SendGrid template without templateId", () => {
    const invalidPayload = {
      to: "test@example.com",
      sendGrid: {
        dynamicTemplateData: {
          name: "Test User",
        },
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Invalid email configuration: Field 'sendGrid.templateId' must be a string"
    );
  });

  // Test invalid custom template (missing name)
  it("should throw ValidationError for custom template without name", () => {
    const invalidPayload = {
      to: "test@example.com",
      template: {
        data: {
          name: "Test User",
        },
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Invalid email configuration: Field 'template.name' must be a string"
    );
  });

  // Test missing recipients
  it("should throw ValidationError when no recipients are provided", () => {
    const invalidPayload = {
      message: {
        subject: "Test Subject",
        text: "Test message",
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Email must have at least one recipient"
    );
  });

  // Test array of recipients
  it("should validate multiple recipients", () => {
    const validPayload = {
      to: ["test1@example.com", "test2@example.com"],
      cc: ["cc1@example.com"],
      bcc: ["bcc1@example.com"],
      message: {
        subject: "Test Subject",
        text: "Test message",
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test UID-based recipients
  it("should validate UID-based recipients", () => {
    const validPayload = {
      toUids: ["user1", "user2"],
      ccUids: ["user3"],
      bccUids: ["user4"],
      message: {
        subject: "Test Subject",
        text: "Test message",
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test optional fields
  it("should validate payload with optional fields", () => {
    const validPayload = {
      to: "test@example.com",
      from: "sender@example.com",
      replyTo: "reply@example.com",
      categories: ["category1", "category2"],
      message: {
        subject: "Test Subject",
        text: "Test message",
        attachments: [],
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  // Test invalid field types
  it("should throw ValidationError for invalid field types", () => {
    const invalidPayload = {
      to: 123, // should be string or array
      message: {
        subject: "Test Subject",
        text: "Test message",
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Invalid email configuration: Field 'to' must be either a string or an array of strings"
    );
  });

  // Test missing message/template/sendGrid
  it("should throw ValidationError when no message, template, or sendGrid is provided", () => {
    const invalidPayload = {
      to: "test@example.com",
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Email configuration must include either a 'message', 'template', or 'sendGrid' object"
    );
  });

  // Test missing subject
  it("should throw ValidationError for message without subject", () => {
    const invalidPayload = {
      to: "test@example.com",
      message: {
        text: "Test message",
      },
    };
    expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
    expect(() => validatePayload(invalidPayload)).toThrow(
      "Invalid email configuration: Field 'message.subject' must be a string"
    );
  });
});
