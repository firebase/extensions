import { describe, expect, test } from "vitest";
import {
  type ParamsSpec,
  parameterize,
  parameterizePath,
} from "../src/build-bundle";

describe("parameterize", () => {
  const params: ParamsSpec = {
    name: { type: "string" },
    age: { type: "integer" },
    score: { type: "float" },
    active: { type: "boolean" },
    req: { type: "string", required: true },
  };

  test("returns non-parameter values unchanged", () => {
    expect(parameterize("literal", params, {})).toBe("literal");
    expect(parameterize(123, params, {})).toBe(123);
  });

  test("resolves string params", () => {
    expect(parameterize("$name", params, { name: "ada" })).toBe("ada");
  });

  test("coerces integer params", () => {
    expect(parameterize("$age", params, { age: "42" })).toBe(42);
  });

  test("coerces float params", () => {
    expect(parameterize("$score", params, { score: "3.5" })).toBe(3.5);
  });

  test("coerces boolean params", () => {
    expect(parameterize("$active", params, { active: "true" })).toBe(true);
    expect(parameterize("$active", params, { active: "false" })).toBe(false);
  });

  test("throws when a required param is missing", () => {
    expect(() => parameterize("$req", params, {})).toThrow(
      "Required param 'req' was missing."
    );
  });
});

describe("parameterizePath", () => {
  const params: ParamsSpec = { id: { type: "string" } };

  test("parameterizes each path segment", () => {
    expect(parameterizePath("users/$id/posts", params, { id: "u1" })).toBe(
      "users/u1/posts"
    );
  });
});
