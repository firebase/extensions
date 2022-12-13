import {
  validateInput,
  FIRESTORE_VALID_CHARACTERS,
  FIRESTORE_COLLECTION_NAME_MAX_CHARS,
} from "../src/config";

describe("config parameters unit testing", () => {
  test(`should import data with old script`, async () => {
    const testInputs = ["test", "extensions-testing", "users/{uid}/contacts"];

    testInputs.forEach((input) => {
      expect(
        validateInput(
          input,
          "test input",
          FIRESTORE_VALID_CHARACTERS,
          FIRESTORE_COLLECTION_NAME_MAX_CHARS
        )
      ).toBe(true);
    });
  });
});
