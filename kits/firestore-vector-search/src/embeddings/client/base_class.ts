export interface EmbedClient {
  readonly batchSize: number;
  getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]>;
  getSingleEmbedding(input: string): Promise<number[]>;
}

export abstract class BaseEmbedClient implements EmbedClient {
  constructor(public readonly batchSize: number) {}

  abstract getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]>;

  async getSingleEmbedding(input: string): Promise<number[]> {
    const embeddings = await this.getEmbeddings([input]);
    return embeddings[0];
  }
}
