import { z } from "genkit";

// Define the schema structure for validation
export const SchemaFieldTypeSchema = z.enum([
  "string",
  "array",
  "map",
  "boolean",
  "number",
  "timestamp",
  "geopoint",
  "reference",
  "null",
  "stringified_map",
]);

export type SchemaFieldType = z.infer<typeof SchemaFieldTypeSchema>;

export const SchemaFieldSchema = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    column_name: z.string().optional(), // Optional column_name
    fields: z.array(SchemaFieldSchema).optional(), // Recursive reference
  })
);

export type SchemaField = z.infer<typeof SchemaFieldSchema>;

export const SchemaSchema = z.object({
  fields: z.array(SchemaFieldSchema),
});

export type Schema = z.infer<typeof SchemaSchema>;
