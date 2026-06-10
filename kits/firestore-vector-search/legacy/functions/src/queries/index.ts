/**
 * Copyright 2023 Google LLC
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
import {config} from '../config';
import {
  FirestoreOnWriteProcess,
  FirestoreOnWriteProcessor,
} from '@invertase/firebase-extension-utilities';
import {embeddingClient} from '../embeddings/client';
import {textVectorStoreClient} from '../vector-store';
import * as functions from 'firebase-functions/v1';
import {Prefilter, prefilterSchema} from './util';
import {z} from 'zod';

const performTextQuery = async ({
  query,
  limit = config.defaultQueryLimit,
  prefilters = [],
}: {
  query: string;
  limit?: number;
  prefilters: any;
}) => {
  await embeddingClient.initialize();

  const parsedPrefilters = z
    .array(prefilterSchema)
    .parse(prefilters) as Prefilter[];

  const embedding = await embeddingClient.getSingleEmbedding(query);
  const result = await textVectorStoreClient.query(
    embedding,
    config.collectionName,
    parsedPrefilters,
    limit,
    config.outputField
  );
  return {result: result};
};

export const textQueryProcess = new FirestoreOnWriteProcess(performTextQuery, {
  id: 'textQuery',
  fieldDependencyArray: ['query', 'limit'],
  shouldBackfill: () => false,
  errorFn: (e: any) => console.error(e),
});

const textQueryOnWriteProcessor = new FirestoreOnWriteProcessor({
  processes: [textQueryProcess],
});

export const handleQueryOnWrite = (
  change: functions.Change<functions.firestore.DocumentSnapshot>
) => {
  return textQueryOnWriteProcessor.run(change);
};
