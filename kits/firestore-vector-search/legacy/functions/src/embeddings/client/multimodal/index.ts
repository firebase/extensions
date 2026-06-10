import {EmbedClient} from '../base_class';
import {config} from '../../../config';
import * as admin from 'firebase-admin';
import {VertexAI} from '@google-cloud/vertexai';
import fetch from 'node-fetch';
import {GoogleAuth} from 'google-auth-library';

export function isBase64Image(image: string): boolean {
  return Buffer.from(image, 'base64').toString('base64') === image;
}

// const isFromStorage = (image: string): boolean => {
//   return image.startsWith('gs://');
// };

export class MultimodalEmbeddingClient extends EmbedClient {
  model?: any;
  vertexAI: VertexAI;

  constructor({
    batchSize,
    dimension,
  }: {
    batchSize: number;
    dimension: 1408 | 512 | 256 | 128;
  }) {
    super({batchSize, dimension});
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.location,
    });
    if (dimension) {
      this.dimension = dimension;
    }
  }

  async initialize() {}

  private async _getImageBuffer(image: string): Promise<Uint8Array> {
    const fileName = image.split(config.bucketName + '/')[1];
    const [buffer] = await admin
      .storage()
      .bucket(config.bucketName)
      .file(fileName)
      .download();
    return buffer;
  }

  private getAccessToken = async () => {
    const auth = new GoogleAuth({
      // Specify the required scopes if necessary
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
      throw new Error('No access token on getAccessToken response');
    }
    return accessToken.token;
  };

  async getEmbeddings(inputs: string[]): Promise<number[][]> {
    // POST https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/multimodalembedding@001:predict

    // TODO: do we add config location?
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/us-central-1/publishers/google/models/multimodalembedding@001:predict`;

    const promises: Promise<{
      image?: {bytesBase64Encoded: string; mimeType: string};
    }>[] = inputs.map(async input => {
      const unit8Array = await this._getImageBuffer(input);

      const buffer = Buffer.from(unit8Array);

      const b64 = buffer.toString('base64');

      return {
        image: {
          bytesBase64Encoded: b64,
          mimeType: 'image/jpeg',
        },
      };
    });
    const instances = await Promise.all(promises);

    const requestBody = {instances};

    const result = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${await this.getAccessToken()}`,
      },
    }).then(res => {
      return res.json();
    });

    const {predictions} = result;
    const imageEmbeddings = predictions.map(p => p.imageEmbedding);

    return imageEmbeddings;
  }
}

// enum ImageUrlSource {
//   STORAGE = 'storage',
// }

// const getImageSource = (image: string): ImageUrlSource => {
//   if (isFromStorage(image)) {
//     return ImageUrlSource.STORAGE;
//   }
//   throw new Error(`Invalid image source: ${image}`);
// };
