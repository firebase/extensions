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
import { formatZodError } from "../src/validation";

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
