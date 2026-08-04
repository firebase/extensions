import { z } from "zod";
import type { EmbedClient } from "../embeddings";
import type { ResolvedVectorSearchConfig } from "../export-config";
import type { FirestoreVectorStoreClient } from "../vector-store";

export const prefilterSchema = z.record(z.any());
export type Prefilter = z.infer<typeof prefilterSchema>;

export interface ParsedQueryRequest {
  query: string;
  limit?: string | number;
  prefilters?: Prefilter[];
}

const querySchema = z
  .object({
    query: z.string(),
    limit: z.union([z.string(), z.number()]).optional(),
    prefilters: z.array(prefilterSchema).optional(),
  })
  .refine((data) => data.query !== undefined, {
    message: "Query field must be provided",
  });

export function parseLimit(limit: unknown): number {
  if (typeof limit !== "string" && typeof limit !== "number") {
    throw new Error("limit must be a string or a number");
  }
  const parsedFloat = Number.parseFloat(String(limit));
  if (!Number.isInteger(parsedFloat) || parsedFloat < 1) {
    throw new Error("limit must be an integer greater than 0");
  }
  return Number.parseInt(String(limit), 10);
}

export function parseQuerySchema(data: unknown): ParsedQueryRequest {
  const parsed = querySchema.parse(data);
  if (typeof parsed.query !== "string") {
    throw new Error("Query field must be provided");
  }
  const request: ParsedQueryRequest = {
    query: parsed.query,
  };
  if (parsed.limit !== undefined) request.limit = parsed.limit;
  if (parsed.prefilters !== undefined) request.prefilters = parsed.prefilters;
  return request;
}

export async function performTextQuery(params: {
  query: string;
  limit?: number;
  prefilters?: ReadonlyArray<Prefilter>;
  embedClient: EmbedClient;
  vectorStore: FirestoreVectorStoreClient;
  config: ResolvedVectorSearchConfig;
}): Promise<{ result: { ids: string[] } }> {
  const embedding = await params.embedClient.getSingleEmbedding(params.query);
  const result = await params.vectorStore.query(
    embedding,
    params.config.collectionPath,
    params.prefilters ?? [],
    params.limit ?? params.config.defaultQueryLimit,
    params.config.outputFieldName
  );
  return { result };
}

export { FirestoreVectorStoreClient } from "../vector-store";
