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

import { createTransport } from "nodemailer";
import { describe, expect, test } from "vitest";

describe("nodemailer", () => {
  test("keeps a display name containing a comma, as the extension's nodemailer 9 does", async () => {
    const transport = createTransport({ streamTransport: true, buffer: true });

    const info = await transport.sendMail({
      from: "Doe, John <john@example.com>",
      to: "Doe, Jane <jane@example.com>",
      text: "hi",
    });
    const headers = info.message.toString();

    expect(headers).toContain('From: "Doe, John" <john@example.com>');
    expect(headers).toContain('To: "Doe, Jane" <jane@example.com>');
  });
});
