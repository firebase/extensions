import { describe, expect, test } from "vitest";

import { resolveConfig } from "../src/export-config";

describe("resolveConfig", () => {
  test("applies defaults for optional fields", () => {
    const resolved = resolveConfig({
      bucket: "demo.appspot.com",
      languageCode: "en-US",
    });

    expect(resolved).toEqual({
      bucket: "demo.appspot.com",
      languageCode: "en-US",
      model: "default",
      outputStoragePath: undefined,
      collectionPath: undefined,
      enableAutomaticPunctuation: true,
      location: "us-central1",
      timeoutSeconds: 540,
      memory: "1GiB",
    });
  });

  test("preserves explicit values", () => {
    const resolved = resolveConfig({
      bucket: "b",
      languageCode: "fr-FR",
      model: "video",
      outputStoragePath: "out",
      collectionPath: "transcriptions",
      enableAutomaticPunctuation: false,
      location: "europe-west2",
      timeoutSeconds: 300,
      memory: "2GiB",
    });

    expect(resolved.model).toBe("video");
    expect(resolved.outputStoragePath).toBe("out");
    expect(resolved.collectionPath).toBe("transcriptions");
    expect(resolved.enableAutomaticPunctuation).toBe(false);
    expect(resolved.location).toBe("europe-west2");
    expect(resolved.timeoutSeconds).toBe(300);
    expect(resolved.memory).toBe("2GiB");
  });

  test("coerces empty optional strings to undefined", () => {
    const resolved = resolveConfig({
      bucket: "b",
      languageCode: "en-US",
      outputStoragePath: "",
      collectionPath: "",
    });

    expect(resolved.outputStoragePath).toBeUndefined();
    expect(resolved.collectionPath).toBeUndefined();
  });
});
