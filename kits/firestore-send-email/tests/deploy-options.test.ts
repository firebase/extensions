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

import { Expression } from "firebase-functions/params";
import { describe, expect, test } from "vitest";

import { envDeployOptions } from "../src/config";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  const options = envDeployOptions();

  test("emits CEL for document, database, and region", () => {
    expect(options.document).toBeInstanceOf(Expression);
    expect(options.database).toBeInstanceOf(Expression);
    expect(options.region).toBeInstanceOf(Expression);

    expect(cel(options.document)).toBe(
      "{{ params.MAIL_COLLECTION }}/{documentId}"
    );
    expect(cel(options.database)).toBe("{{ params.DATABASE }}");
    expect(cel(options.region)).toBe("{{ params.DATABASE_REGION }}");
  });

  test("serialized deploy-time options do not contain undefined", () => {
    const serialized = JSON.stringify(
      Object.fromEntries(
        Object.entries(options).map(([key, value]) => [key, cel(value)])
      )
    );

    expect(serialized).not.toContain("undefined");
  });
});
