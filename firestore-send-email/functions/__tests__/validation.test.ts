import { validatePayload, ValidationError } from "../src/validation";

describe("validatePayload", () => {
  describe("valid payloads", () => {
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

    it("should validate payload with friendly name in from field", () => {
      const validPayload = {
        to: "test@example.com",
        from: "Friendly Firebaser test@example.com",
        message: {
          subject: "Test Subject",
          text: "Test message",
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate a template payload without html/text fields", () => {
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

    it("should validate a template payload with message override", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
          data: {
            name: "Test User",
          },
        },
        message: {
          subject: "Custom Subject",
          attachments: [],
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate a template payload with empty data", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate template with message containing only subject", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
        },
        message: {
          subject: "Test Subject",
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate template with message containing optional fields", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
          data: { name: "User" },
        },
        message: {
          subject: "Test Subject",
          attachments: [],
          categories: ["category1"],
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate template payload when message has no html or text", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
          data: { userName: "John Doe" },
        },
        message: {
          subject: "Welcome!",
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate template with completely empty message object", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
          data: { userName: "John Doe" },
        },
        message: {
          // Completely empty - template provides everything
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });

    it("should validate template without message object", () => {
      const validPayload = {
        to: "test@example.com",
        template: {
          name: "EGFMB64MzmVz0Or75ctL",
          data: { userName: "cabljac", name: "jacob" },
        },
      };
      expect(() => validatePayload(validPayload)).not.toThrow();
    });
  });

  it("should validate a SendGrid payload with only mailSettings", () => {
    const validPayload = {
      to: "test@example.com",
      sendGrid: {
        mailSettings: {
          sandboxMode: {
            enable: true,
          },
        },
      },
    };
    expect(() => validatePayload(validPayload)).not.toThrow();
  });

  describe("invalid payloads", () => {
    it("should throw ValidationError for message without text or html", () => {
      const invalidPayload = {
        to: "test@example.com",
        message: {
          subject: "Test Subject",
        },
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid message configuration: At least one of 'text' or 'html' must be provided in message"
      );
    });

    it("should throw ValidationError for SendGrid template with dynamicTemplateData but no templateId", () => {
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
        "Invalid sendGrid configuration: Field 'templateId' is required when 'dynamicTemplateData' is provided"
      );
    });

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
        "Invalid template configuration: Field 'template.name' must be a string"
      );
    });

    it("should throw ValidationError when no recipients are provided", () => {
      const invalidPayload = {
        message: {
          subject: "Test Subject",
          text: "Test message",
        },
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid email configuration: Email must have at least one recipient"
      );
    });

    it("should throw ValidationError for invalid field types", () => {
      const invalidPayload = {
        to: 123,
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

    it("should throw ValidationError when no message, template, or sendGrid is provided", () => {
      const invalidPayload = {
        to: "test@example.com",
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid email configuration: Email configuration must include either a 'message', 'template', or 'sendGrid' object"
      );
    });

    it("should throw ValidationError for message without subject", () => {
      const invalidPayload = {
        to: "test@example.com",
        message: {
          text: "Test message",
        },
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid message configuration: Field 'message.subject' must be a string"
      );
    });

    it("should throw ValidationError for template with invalid name type", () => {
      const invalidPayload = {
        to: "test@example.com",
        template: {
          name: 123,
        },
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid template configuration: Field 'template.name' must be a string"
      );
    });

    it("should throw ValidationError for template with invalid type", () => {
      const invalidPayload = {
        to: "test@example.com",
        template: 123,
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid template configuration: Field 'template' must be a map"
      );
    });

    it("should throw ValidationError for template with invalid data type", () => {
      const invalidPayload = {
        to: "test@example.com",
        template: {
          name: "welcome-email",
          data: "invalid-data",
        },
      };
      expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
      expect(() => validatePayload(invalidPayload)).toThrow(
        "Invalid template configuration: Field 'template.data' must be a map"
      );
    });
  });

  describe("attachment validation", () => {
    describe("valid attachments", () => {
      it("should validate plain text attachment", () => {
        const validPayload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                filename: "hello.txt",
                content: "Hello world!",
              },
            ],
          },
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate binary buffer attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate local file attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate attachment with implicit filename", () => {
        const validPayload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                path: "/absolute/path/to/image.png",
              },
            ],
          },
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate attachment with custom content type", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate remote file attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate base64 encoded attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate data URI attachment", () => {
        const validPayload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                path: "data:text/plain;base64,SGVsbG8gd29ybGQ=",
              },
            ],
          },
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate pre-built MIME node attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate embedded image attachment", () => {
        const validPayload = {
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
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });

      it("should validate multiple attachments", () => {
        const validPayload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: [
              {
                filename: "file1.txt",
                content: "Content 1",
              },
              {
                filename: "file2.txt",
                content: "Content 2",
              },
            ],
          },
        };
        expect(() => validatePayload(validPayload)).not.toThrow();
      });
    });

    describe("invalid attachments", () => {
      it("should throw error for invalid httpHeaders type", () => {
        const invalidPayload = {
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
        expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
        expect(() => validatePayload(invalidPayload)).toThrow(
          "Invalid message configuration: Field 'message.attachments.0.httpHeaders' must be a map"
        );
      });

      it("should throw error for invalid headers type", () => {
        const invalidPayload = {
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
        expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
        expect(() => validatePayload(invalidPayload)).toThrow(
          "Invalid message configuration: Field 'message.attachments.0.headers' must be a map"
        );
      });

      it("should throw error for non-array attachments", () => {
        const invalidPayload = {
          to: "test@example.com",
          message: {
            subject: "Test Subject",
            text: "Test message",
            attachments: {
              filename: "test.txt",
              content: "test",
            },
          },
        };
        expect(() => validatePayload(invalidPayload)).toThrow(ValidationError);
        expect(() => validatePayload(invalidPayload)).toThrow(
          "Invalid message configuration: Field 'message.attachments' must be an array"
        );
      });
    });
  });
});
