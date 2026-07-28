import { DocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { logger } from "./logger";

const intSchema = z.union([
  z.string().transform((arg) => parseInt(arg) || undefined),
  z.number(),
]);
const floatSchema = z.union([z.string().transform(parseFloat), z.number()]);

const overridesSchema = z.object({
  context: z.string().optional(),
  model: z.string().optional(),
  topK: intSchema.optional(),
  candidateCount: intSchema.optional(),
  maxOutputTokens: intSchema.optional(),
  topP: floatSchema.optional(),
  temperature: floatSchema.optional(),
});

export function extractOverrides(
  docSnap: DocumentSnapshot
): Record<string, unknown> {
  const data = docSnap.data();

  try {
    return overridesSchema.parse(data);
  } catch (e) {
    logger.error("Error parsing overrides from parent doc", e);
    throw new Error("Error parsing overrides from parent doc.");
  }
}
