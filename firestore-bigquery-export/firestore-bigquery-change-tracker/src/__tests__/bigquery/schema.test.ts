import {
  RawChangelogSchema,
  RawChangelogViewSchema,
  getRawChangelogPartitioned,
} from "../../bigquery/schema";

describe("getRawChangelogPartitioned function", () => {
  test("returns RawChangelogSchema with extra field", () => {
    const RawChangelogSchemaExtraField = getRawChangelogPartitioned(
      "post_date",
      "TIMESTAMP",
      false
    );
    expect(RawChangelogSchemaExtraField.fields.length).toBeGreaterThan(
      RawChangelogSchema.fields.length
    );
  });
  test("returns RawChangelogSchema without extra field if schema field name exist", () => {
    const RawChangelogSchemaExtraField = getRawChangelogPartitioned(
      "timestamp",
      "TIMESTAMP",
      false
    );
    expect(RawChangelogSchemaExtraField.fields.length).toEqual(
      RawChangelogSchema.fields.length
    );
  });
  test("returns RawChangelogViewSchema with extra field", () => {
    const RawChangelogSchemaExtraField = getRawChangelogPartitioned(
      "post_date",
      "TIMESTAMP",
      true
    );
    expect(RawChangelogSchemaExtraField.fields.length).toBeGreaterThan(
      RawChangelogViewSchema.fields.length
    );
  });
  test("returns RawChangelogViewSchema extra field if schema field name exist", () => {
    const RawChangelogSchemaExtraField = getRawChangelogPartitioned(
      "document_id",
      "TIMESTAMP",
      true
    );
    expect(RawChangelogSchemaExtraField.fields.length).toEqual(
      RawChangelogViewSchema.fields.length
    );
  });
  test("returns RawChangelogViewSchema without extra field if wrong parameters", () => {
    const RawChangelogSchemaExtraField = getRawChangelogPartitioned(
      undefined,
      undefined,
      true
    );
    expect(RawChangelogSchemaExtraField.fields.length).toEqual(
      RawChangelogViewSchema.fields.length
    );
  });
});
