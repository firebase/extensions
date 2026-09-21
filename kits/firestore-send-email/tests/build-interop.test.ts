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

import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

// The subject is the compiled output, not src: tsc's esModuleInterop helper
// strips the prototype methods off the instance @sendgrid/mail exports, and
// vitest's own transform does not reproduce that. The named import in
// nodemailer-sendgrid emits no helper; this guards a revert to a default one.
// The pretest hook builds lib/ before this runs.
const requireBuilt = createRequire(import.meta.url);

describe("built SendGridTransport", () => {
  test("reaches the methods on the @sendgrid/mail instance", () => {
    const { SendGridTransport } = requireBuilt("../lib/nodemailer-sendgrid");
    expect(() => new SendGridTransport({ apiKey: "SG.test" })).not.toThrow();
  });
});
