import * as admin from "firebase-admin";

export class BackfillMetadata {
  public chunksEnqueued: number;
  public chunksProcessed: number;
  public allChunksEnqueued: boolean;
  public path: string;

  constructor({
    path,
    chunksEnqueued,
    chunksProcessed,
    allChunksEnqueued,
  }: {
    path: string;
    chunksEnqueued: number;
    chunksProcessed: number;
    allChunksEnqueued: boolean;
  }) {
    this.chunksEnqueued = chunksEnqueued;
    this.chunksProcessed = chunksProcessed;
    this.allChunksEnqueued = allChunksEnqueued;
    this.path = path;
  }

  public async set() {
    await admin.firestore().doc(this.path).set({
      chunksEnqueued: this.chunksEnqueued,
      chunksProcessed: this.chunksProcessed,
      allChunksEnqueued: this.allChunksEnqueued,
    });
  }

  static validateMetadata(data: any) {
    if (
      !data ||
      typeof data !== "object" ||
      data.chunksEnqueued === undefined ||
      data.chunksProcessed === undefined ||
      data.allChunksEnqueued === undefined ||
      !BackfillMetadata.isPositiveInteger(data.chunksEnqueued) ||
      !BackfillMetadata.isPositiveInteger(data.chunksProcessed) ||
      typeof data.allChunksEnqueued !== "boolean"
    ) {
      throw new Error("Validation failed.");
    }
  }

  static isPositiveInteger(value: any) {
    return typeof value === "number" && value >= 0 && Number.isInteger(value);
  }

  static async fromFirestore({
    path,
  }: {
    path: string;
  }): Promise<BackfillMetadata> {
    const doc = await admin.firestore().doc(path).get();

    if (!doc.exists || !doc.data()) {
      const metadata = new BackfillMetadata({
        path,
        chunksEnqueued: 0,
        chunksProcessed: 0,
        allChunksEnqueued: false,
      });
      await metadata.set();
      return metadata;
    }
    const data = doc.data();

    BackfillMetadata.validateMetadata(data);

    return new BackfillMetadata({
      path,
      chunksEnqueued: data.chunksEnqueued,
      chunksProcessed: data.chunksProcessed,
      allChunksEnqueued: data.allChunksEnqueued,
    });
  }

  async incrementChunksEnqueued() {
    admin
      .firestore()
      .doc(this.path)
      .update({
        chunksEnqueued: admin.firestore.FieldValue.increment(1),
      });
    this.chunksEnqueued++;
  }

  async incrementChunksProcessed() {
    admin
      .firestore()
      .doc(this.path)
      .update({
        chunksProcessed: admin.firestore.FieldValue.increment(1),
      });
    this.chunksProcessed++;
  }

  async setAllChunksEnqueued() {
    this.allChunksEnqueued = true;
    await admin.firestore().doc(this.path).update({
      allChunksEnqueued: true,
    });
  }

  async checkIfComplete() {
    return (
      this.allChunksEnqueued && this.chunksEnqueued === this.chunksProcessed
    );
  }
}
