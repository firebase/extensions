import { z } from "zod";
import { logger } from "firebase-functions/v1";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const baseMessageSchema = z.object({
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(z.any()).optional(),
});

const standardMessageSchema = baseMessageSchema
  .required({ subject: true })
  .refine((data) => !!data.text || !!data.html, {
    message: "At least one of 'text' or 'html' must be provided in message",
  });

const templateMessageSchema = baseMessageSchema.optional();

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

const templateSchema = z.object({
  name: z.string().min(1, "Template name cannot be empty"),
  data: z.record(z.any()).optional(),
});

const recipientSchema = z.union([
  z.string().email(),
  z.array(z.string().email()),
]);
const uidArraySchema = z.array(z.string().min(1));

const payloadSchema = z
  .object({
    to: recipientSchema.optional(),
    cc: recipientSchema.optional(),
    bcc: recipientSchema.optional(),
    toUids: uidArraySchema.optional(),
    ccUids: uidArraySchema.optional(),
    bccUids: uidArraySchema.optional(),
    from: z.string().email().optional(),
    replyTo: z.string().email().optional(),
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

function formatZodError(
  error: z.ZodError,
  context: string = "email configuration"
): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : context;
    switch (issue.code) {
      case "invalid_type":
        if (issue.expected === "string") {
          return `Field '${path}' must be a string`;
        }
        if (issue.expected === "array") {
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
          return `Field '${path}' must be either a string or a map`;
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
