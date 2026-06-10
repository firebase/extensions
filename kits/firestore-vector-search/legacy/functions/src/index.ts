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

import {config} from './config';
import * as functions from 'firebase-functions/v1';
import {
  FirestoreBackfillOptions,
  firestoreProcessBackfillTask,
  firestoreProcessBackfillTrigger,
} from '@invertase/firebase-extension-utilities';
import {handleQueryCall} from './queries/query_on_call';
import {
  embedProcess,
  handleEmbedOnWrite,
  updateEmbedProcess,
} from './embeddings';
import {handleQueryOnWrite} from './queries';
import {DocumentData} from '@google-cloud/firestore';
import {getExtensions} from 'firebase-admin/extensions';
import * as logs from './logs';
import {createIndex} from './queries/setup';

logs.init();

// Embeddings

const runtime = getExtensions().runtime();

export const embedOnWrite = functions.firestore
  .document(`${config.collectionName}/{docId}`)
  .onWrite(handleEmbedOnWrite);

const shouldDoBackfill = async (metadata?: DocumentData) => {
  if (!config.doBackfill) {
    await runtime.setProcessingState(
      'PROCESSING_WARNING',
      `Backfill is disabled, index setup will start with the first write operation to the collection ${config.collectionName}.`
    );
    return false;
  }
  // if the embedding provider or model is different, run the backfill
  if (
    !metadata ||
    metadata.embeddingProvider !== config.embeddingProvider ||
    metadata.dimension !== config.dimension ||
    metadata.inputField !== config.inputField ||
    metadata.outputField !== config.outputField
  ) {
    await runtime.setProcessingState(
      'NONE',
      `Updating Embeddings for collection ${config.collectionName}.`
    );
    return true;
  }
  return false;
};

const backfillOptions: FirestoreBackfillOptions = {
  queueName: config.backfillQueueName,
  collectionName: config.collectionName,
  metadataDocumentPath: config.indexMetadataDocumentPath,
  shouldDoBackfill,
  statusField: config.statusField,
  extensionInstanceId: config.instanceId,
  metadata: {
    embeddingProvider: config.embeddingProvider,
    dimension: config.dimension,
    inputField: config.inputField,
    outputField: config.outputField,
  },
};

//  Backfill

const onInstallTrigger = firestoreProcessBackfillTrigger(
  embedProcess,
  backfillOptions
);

export const backfillTrigger = functions.tasks
  .taskQueue()
  .onDispatch(async (_data, _context) => {
    try {
      await createIndex({
        collectionName: config.collectionName,
        dimension: config.dimension,
        projectId: config.projectId,
        fieldPath: config.outputField,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error creating firestore Vector index');
    }

    return onInstallTrigger();
  });

export const backfillTask = functions.tasks
  .taskQueue()
  .onDispatch(firestoreProcessBackfillTask(embedProcess, backfillOptions));

// Update onConfigure

const updateOptions: FirestoreBackfillOptions = {
  queueName: config.updateQueueName,
  collectionName: config.collectionName,
  statusField: config.statusField,
  metadataDocumentPath: config.indexMetadataDocumentPath,
  shouldDoBackfill,
  extensionInstanceId: config.instanceId,
  metadata: {
    embeddingProvider: config.embeddingProvider,
  },
};

const onUpdateTrigger = firestoreProcessBackfillTrigger(
  updateEmbedProcess,
  updateOptions
);

export const updateTrigger = functions.tasks
  .taskQueue()
  .onDispatch(async (_data, _context) => {
    try {
      await createIndex({
        collectionName: config.collectionName,
        dimension: config.dimension,
        projectId: config.projectId,
        fieldPath: config.outputField,
      });
    } catch (e) {
      console.error(e);
      throw new Error(
        'Error creating new firestore Vector index during update'
      );
    }

    return onUpdateTrigger();
  });

export const updateTask = functions.tasks
  .taskQueue()
  .onDispatch(firestoreProcessBackfillTask(updateEmbedProcess, updateOptions));

// Queries

export const queryOnWrite = functions.firestore
  .document(`${config.queryCollectionName}/{queryId}`)
  .onWrite(handleQueryOnWrite);

export const queryCallable = functions.https.onCall(handleQueryCall);
