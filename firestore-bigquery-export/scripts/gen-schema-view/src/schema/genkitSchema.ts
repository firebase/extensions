/*
 * Copyright 2025 Google LLC
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
