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
