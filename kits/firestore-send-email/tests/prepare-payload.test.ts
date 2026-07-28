import { describe, expect, test, vi } from "vitest";
import type { ResolvedSendEmailConfig } from "../src/export-config";
import { preparePayload } from "../src/prepare-payload";

const baseConfig: ResolvedSendEmailConfig = {
  region: "us-central1",
  databaseId: "(default)",
  databaseRegion: "us-central1",
  mailCollection: "mail",
  defaultFrom: "sender@example.com",
  testing: false,
  ttlExpireType: "never",
  ttlExpireValue: 1,
  tlsOptions: "{}",
  oauthSecure: true,
  authType: "UsernamePassword" as any,
  usersCollection: "users",
};

describe("preparePayload", () => {
  test("resolves uid recipients through the users collection", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: (id: string) => ({ id }),
      })),
      getAll: vi.fn(async (...args: any[]) => {
        const docs = args.slice(0, -1);
        return docs.map((doc: any) => ({
          id: doc.id,
          exists: true,
          get: () => `${doc.id}@example.com`,
        }));
      }),
    } as any;

    const result = await preparePayload(
      {
        toUids: ["alice"],
        ccUids: ["bob"],
        bcc: "carol@example.com",
        message: { subject: "Hello", text: "World" },
      },
      {
        db,
        config: baseConfig,
      }
    );

    expect(result.to).toEqual(["alice@example.com"]);
    expect(result.cc).toEqual(["bob@example.com"]);
    expect(result.bcc).toEqual(["carol@example.com"]);
  });

  test("preserves inherited empty uid array getAll failure", async () => {
    const db = {
      collection: vi.fn(() => ({
        doc: (id: string) => ({ id }),
      })),
      getAll: vi.fn(async (...args: any[]) => {
        const docs = args.slice(0, -1);
        if (docs.length === 0) {
          throw new Error("Expected at least one document ref.");
        }
        return [];
      }),
    } as any;

    await expect(
      preparePayload(
        {
          to: "recipient@example.com",
          toUids: [],
          message: { subject: "Hello", text: "World" },
        },
        {
          db,
          config: baseConfig,
        }
      )
    ).rejects.toThrow("Expected at least one document ref.");
    expect(db.getAll).toHaveBeenCalledOnce();
  });
});
