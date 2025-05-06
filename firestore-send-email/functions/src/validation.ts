import { z } from "zod";
import { logger } from "firebase-functions/v1";

// Custom error class for validation errors
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Standard message schema (for non-template, non-SendGrid)
const standardMessageSchema = z
  .object({
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
    attachments: z.array(z.any()).optional(),
  })
  .refine((data) => !!data.text || !!data.html, {
    message: "At least one of 'text' or 'html' must be provided in message",
  });

// SendGrid template schema
const sendGridSchema = z.object({
  templateId: z.string(),
  dynamicTemplateData: z.record(z.any()).optional(),
  mailSettings: z.record(z.any()).optional(),
});

// Template schema
const templateSchema = z.object({
  name: z.string(),
  data: z.record(z.any()).optional(),
});

// Main payload schema
const payloadSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  toUids: z.array(z.string()).optional(),
  ccUids: z.array(z.string()).optional(),
  bccUids: z.array(z.string()).optional(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  message: standardMessageSchema.optional(),
  template: templateSchema.optional(),
  sendGrid: sendGridSchema.optional(),
  categories: z.array(z.string()).optional(),
});

function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".");
    switch (issue.code) {
      case "invalid_type":
        if (issue.expected === "string") {
          return `Field '${path}' must be a string`;
        }
        if (issue.expected === "array") {
          return `Field '${path}' must be an array`;
        }
        return `Field '${path}' must be ${issue.expected}`;
      case "invalid_string":
        return `Field '${path}' is invalid`;
      case "too_small":
        return `Field '${path}' is required`;
      case "invalid_union":
        return `Field '${path}' must be either a string or an array of strings`;
      default:
        return issue.message;
    }
  });
  return issues.join(". ");
}

export function validatePayload(payload: any) {
  try {
    // First validate the overall payload structure
    const result = payloadSchema.safeParse(payload);
    if (!result.success) {
      throw new ValidationError(
        `Invalid email configuration: ${formatZodError(result.error)}`
      );
    }

    // If using SendGrid template, validate sendGrid object
    if (payload.sendGrid) {
      const sendGridResult = sendGridSchema.safeParse(payload.sendGrid);
      if (!sendGridResult.success) {
        throw new ValidationError(
          `Invalid SendGrid configuration: ${formatZodError(
            sendGridResult.error
          )}`
        );
      }
      return;
    }

    // If using custom template, validate template object
    if (payload.template) {
      const templateResult = templateSchema.safeParse(payload.template);
      if (!templateResult.success) {
        throw new ValidationError(
          `Invalid template configuration: ${formatZodError(
            templateResult.error
          )}`
        );
      }
      return;
    }

    // If not using templates, validate message object
    if (!payload.message) {
      throw new ValidationError(
        "Email configuration must include either a 'message', 'template', or 'sendGrid' object"
      );
    }

    const messageResult = standardMessageSchema.safeParse(payload.message);
    if (!messageResult.success) {
      throw new ValidationError(
        `Invalid message configuration: ${formatZodError(messageResult.error)}`
      );
    }

    // Validate that there is at least one recipient
    if (
      !payload.to?.length &&
      !payload.cc?.length &&
      !payload.bcc?.length &&
      !payload.toUids?.length &&
      !payload.ccUids?.length &&
      !payload.bccUids?.length
    ) {
      throw new ValidationError(
        "Email must have at least one recipient (to, cc, bcc, toUids, ccUids, or bccUids)"
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error("Validation failed:", error.message);
      throw error;
    }
    logger.error("Unexpected validation error:", error);
    throw new ValidationError(
      "An unexpected error occurred while validating the email configuration"
    );
  }
}
