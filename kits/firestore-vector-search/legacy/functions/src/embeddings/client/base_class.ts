export class EmbedClient {
  batchSize: number;
  dimension: number;
  constructor({batchSize, dimension}: {batchSize: number; dimension: number}) {
    this.batchSize = batchSize;
    this.dimension = dimension;
  }

  async initialize() {
    // optional to implement this as it might not be needed.
  }

  async getEmbeddings(_inputs: string[]): Promise<number[][]> {
    throw new Error('Not implemented');
  }

  async getSingleEmbedding(input: string): Promise<number[]> {
    const embeddings = await this.getEmbeddings([input]);
    return embeddings[0];
  }
}
