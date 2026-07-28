/*
 * Copyright 2019 Google LLC
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

import { logger } from "firebase-functions";
import { z } from "zod";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const attachmentSchema = z
  .object({
    filename: z.string().nullable().optional(),
    content: z
      .union([z.string(), z.instanceof(Buffer), z.any()])
      .nullable()
      .optional(),
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
  .array(attachmentSchema)
  .optional()
  .transform((attachments) =>
    attachments
      ? attachments.filter((attachment) => Object.keys(attachment).length > 0)
      : undefined
  );

const baseMessageSchema = z.object({
  subject: z.string().optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  attachments: attachmentsSchema,
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
    customArgs: z.record(z.string()).optional(),
    ipPoolName: z.string().optional(),
  })
  .refine((data) => !data.dynamicTemplateData || data.templateId, {
    message:
      "Field 'templateId' is required when 'dynamicTemplateData' is provided",
    path: ["templateId"],
  });

const templateSchema = z.object({
  name: z.string().min(1, "Template name cannot be empty"),
  data: z.record(z.any()).optional(),
});

const recipientSchema = z.union([z.string(), z.array(z.string())]);
const uidArraySchema = z.array(z.string().min(1));

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
    (data) =>
      [data.to, data.cc, data.bcc, data.toUids, data.ccUids, data.bccUids].some(
        (field) => (Array.isArray(field) ? field.length > 0 : field)
      ),
    { message: "Email must have at least one recipient" }
  )
  .refine((data) => !!(data.message || data.template || data.sendGrid), {
    message:
      "Email configuration must include either a 'message', 'template', or 'sendGrid' object",
  });

function formatZodError(
  error: z.ZodError,
  context = "email configuration"
): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : context;
    switch (issue.code) {
      case "invalid_type":
        if (issue.expected === "string")
          return `Field '${path}' must be a string`;
        if (issue.expected === "array")
          return `Field '${path}' must be an array`;
        if (issue.expected === "object") return `Field '${path}' must be a map`;
        return `Field '${path}' must be ${issue.expected}`;
      case "too_small":
        return issue.minimum === 1
          ? `Field '${path}' cannot be empty`
          : `Field '${path}' is required`;
      case "invalid_union":
        return path === "template"
          ? `Field '${path}' must be a map with a 'name' field`
          : `Field '${path}' must be either a string or an array of strings`;
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
  return new z.ZodError(
    error.issues.map((issue) => ({
      ...issue,
      path: [...pathPrefix, ...issue.path],
    }))
  );
}

function validateField(
  fieldValue: unknown,
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

export function validatePayload(payload: unknown) {
  try {
    const candidate = payload as Record<string, unknown>;

    if (candidate.sendGrid !== undefined) {
      validateField(
        candidate.sendGrid,
        sendGridSchema,
        "sendGrid",
        "sendGrid configuration"
      );
    }

    if (candidate.template !== undefined) {
      validateField(
        candidate.template,
        templateSchema,
        "template",
        "template configuration"
      );
    }

    if (
      candidate.message &&
      Object.keys(candidate.message as object).length > 0
    ) {
      const messageSchema = candidate.template
        ? templateMessageSchema
        : standardMessageSchema;
      validateField(
        candidate.message,
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
