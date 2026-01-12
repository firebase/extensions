import { z } from "zod";
import { logger } from "firebase-functions/v1";

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Schema for email attachments
 */
export const attachmentSchema = z
  .object({
    filename: z.string().nullable().optional(),
    content: z
      .union([z.string(), z.instanceof(Buffer), z.any()])
      .nullable()
      .optional(), // Stream type is handled as any
    path: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
    httpHeaders: z.record(z.string()).nullable().optional(),
    contentType: z.string().nullable().optional(),
    contentDisposition: z.string().nullable().optional(),
    cid: z.string().nullable().optional(),
    encoding: z.string().nullable().optional(),
    headers: z.record(z.string()).nullable().optional(),
    raw: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((data) => {
    // Only keep properties that are defined in the schema
    const validKeys = [
      "filename",
      "content",
      "path",
      "href",
      "httpHeaders",
      "contentType",
      "contentDisposition",
      "cid",
      "encoding",
      "headers",
      "raw",
    ];
    return Object.fromEntries(
      Object.entries(data).filter(([key]) => validKeys.includes(key))
    );
  });

export const attachmentsSchema = z
  .array(attachmentSchema, {
    invalid_type_error:
      "Field 'attachments' must be an array. If you have a single attachment object, wrap it in an array (e.g., [{ filename: '...', path: '...' }])",
  })
  .optional()
  .transform((attachments) =>
    attachments
      ? attachments.filter((attachment) => Object.keys(attachment).length > 0)
      : undefined
  );

/**
 * Base schema for email message content.
 */
const baseMessageSchema = z.object({
  subject: z.string().optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  attachments: attachmentsSchema,
});

/**
 * Schema for standard email messages requiring subject and text/html content.
 */
const standardMessageSchema = baseMessageSchema
  .required({ subject: true })
  .refine((data) => !!data.text || !!data.html, {
    message: "At least one of 'text' or 'html' must be provided in message",
  });

/**
 * Schema for template-based messages (subject and content optional).
 */
const templateMessageSchema = baseMessageSchema.optional();

/**
 * Schema for SendGrid-specific configuration options.
 */
const sendGridSchema = z
  .object({
    templateId: z.string().optional(),
    dynamicTemplateData: z.record(z.any()).optional(),
    mailSettings: z.record(z.any()).optional(),
  })
  .refine(
    (data) => {
      return !data.dynamicTemplateData || data.templateId;
    },
    {
      message:
        "Field 'templateId' is required when 'dynamicTemplateData' is provided",
      path: ["templateId"],
    }
  );

/**
 * Schema for custom email templates.
 */
const templateSchema = z.object({
  name: z.string().min(1, "Template name cannot be empty"),
  data: z.record(z.any()).optional(),
});

/**
 * Schema for email recipients (single email or array of emails).
 */
const recipientSchema = z.union([z.string(), z.array(z.string())]);

/**
 * Schema for arrays of UIDs.
 */
const uidArraySchema = z.array(z.string().min(1));

/**
 * Main schema for the entire email payload.
 */
const payloadSchema = z
  .object({
    to: recipientSchema.optional(),
    cc: recipientSchema.optional(),
    bcc: recipientSchema.optional(),
    toUids: uidArraySchema.optional(),
    ccUids: uidArraySchema.optional(),
    bccUids: uidArraySchema.optional(),
    from: z.string().optional(),
    replyTo: z.string().optional(),
    message: baseMessageSchema.optional(),
    template: templateSchema.optional(),
    sendGrid: sendGridSchema.optional(),
    categories: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      const hasRecipients = [
        data.to,
        data.cc,
        data.bcc,
        data.toUids,
        data.ccUids,
        data.bccUids,
      ].some((field) => (Array.isArray(field) ? field.length > 0 : field));

      return hasRecipients;
    },
    {
      message: "Email must have at least one recipient",
    }
  )
  .refine(
    (data) => {
      return !!(data.message || data.template || data.sendGrid);
    },
    {
      message:
        "Email configuration must include either a 'message', 'template', or 'sendGrid' object",
    }
  );

/**
 * Formats Zod validation errors into human-readable error messages.
 * @param error - The Zod error to format
 * @param context - The context or field name where the error occurred
 * @returns A formatted error message string
 */
function formatZodError(
  error: z.ZodError,
  context: string = "email configuration"
): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : context;
    switch (issue.code) {
      case "invalid_type":
        if (issue.received === "undefined") {
          return `Field '${path}' must be a ${issue.expected}`;
        }

        if (issue.expected === "string") {
          return `Field '${path}' must be a string`;
        }
        if (issue.expected === "array") {
          if (issue.message && !issue.message.startsWith("Expected")) {
            const customMessage = issue.message.replace(
              /Field 'attachments'/g,
              `Field '${path}'`
            );
            return customMessage;
          }
          return `Field '${path}' must be an array`;
        }
        if (issue.expected === "object") {
          return `Field '${path}' must be a map`;
        }
        return `Field '${path}' must be ${issue.expected}`;
      case "invalid_string":
        if (issue.validation === "email") {
          return `Field '${path}' must be a valid email address`;
        }
        return `Field '${path}' is invalid`;
      case "too_small":
        if (issue.minimum === 1) {
          return `Field '${path}' cannot be empty`;
        }
        return `Field '${path}' is required`;
      case "invalid_union":
        if (path === "template") {
          return `Field '${path}' must be a map with a 'name' field`;
        }
        return `Field '${path}' must be either a string or an array of strings`;
      case "custom":
        return issue.message;
      default:
        return issue.message;
    }
  });
  return `Invalid ${context}: ${issues.join(". ")}`;
}

/**
 * Adjusts Zod error issues by adding a path prefix.
 * @param error - The Zod error to adjust
 * @param pathPrefix - The prefix to add to error paths
 * @returns A new Zod error with adjusted paths
 */
function adjustZodErrorIssues(
  error: z.ZodError,
  pathPrefix: string[]
): z.ZodError {
  const adjustedIssues = error.issues.map((issue) => ({
    ...issue,
    path: [...pathPrefix, ...issue.path],
  }));
  return new z.ZodError(adjustedIssues);
}

/**
 * Validates a specific field using a Zod schema and throws a ValidationError on failure.
 * @param fieldValue - The value to validate
 * @param schema - The Zod schema to use for validation
 * @param fieldName - The name of the field being validated
 * @param context - The context for error messages
 * @throws {ValidationError} When validation fails
 */
function validateField(
  fieldValue: any,
  schema: z.ZodSchema,
  fieldName: string,
  context: string
): void {
  const result = schema.safeParse(fieldValue);
  if (!result.success) {
    const adjustedError = adjustZodErrorIssues(result.error, [fieldName]);
    throw new ValidationError(formatZodError(adjustedError, context));
  }
}

/**
 * Validates an email payload against predefined schemas.
 * Validates specific fields first (sendGrid, template, message) with context-specific error messages,
 * then validates the entire payload structure.
 * @param payload - The email payload to validate
 * @throws {ValidationError} When validation fails
 */
export function validatePayload(payload: any) {
  try {
    if (payload.sendGrid !== undefined) {
      validateField(
        payload.sendGrid,
        sendGridSchema,
        "sendGrid",
        "sendGrid configuration"
      );
    }

    if (payload.template !== undefined) {
      validateField(
        payload.template,
        templateSchema,
        "template",
        "template configuration"
      );
    }

    if (payload.message && Object.keys(payload.message).length > 0) {
      const messageSchema = payload.template
        ? templateMessageSchema
        : standardMessageSchema;
      validateField(
        payload.message,
        messageSchema,
        "message",
        "message configuration"
      );
    }

    const result = payloadSchema.safeParse(payload);
    if (!result.success) {
      throw new ValidationError(formatZodError(result.error));
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
