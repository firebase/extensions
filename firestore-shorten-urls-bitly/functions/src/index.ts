/*
 * Copyright 2019 Google LLC
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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { BitlyClient } from "bitly";

import config from "./config";
import * as logs from "./logs";

enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

const bitly = new BitlyClient(config.bitlyAccessToken);
// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();

export const fsurlshortener = functions.handler.firestore.document.onWrite(
  async (change): Promise<void> => {
    logs.start();

    if (config.urlFieldName === config.shortUrlFieldName) {
      logs.fieldNamesNotDifferent();
      return;
    }

    const changeType = getChangeType(change);

    switch (changeType) {
      case ChangeType.CREATE:
        await handleCreateDocument(change.after);
        break;
      case ChangeType.DELETE:
        handleDeleteDocument();
        break;
      case ChangeType.UPDATE:
        await handleUpdateDocument(change.before, change.after);
        break;
      default: {
        throw new Error(`Invalid change type: ${changeType}`);
      }
    }

    logs.complete();
  }
);

const extractUrl = (snapshot: admin.firestore.DocumentSnapshot) => {
  return snapshot.get(config.urlFieldName);
};

const getChangeType = (
  change: functions.Change<admin.firestore.DocumentSnapshot>
) => {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

const handleCreateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
) => {
  const url = extractUrl(snapshot);
  if (url) {
    logs.documentCreatedWithUrl();
    await shortenUrl(snapshot);
  } else {
    logs.documentCreatedNoUrl();
  }
};

const handleDeleteDocument = () => {
  logs.documentDeleted();
};

const handleUpdateDocument = async (
  before: admin.firestore.DocumentSnapshot,
  after: admin.firestore.DocumentSnapshot
) => {
  const urlAfter = extractUrl(after);
  const urlBefore = extractUrl(before);

  if (urlAfter === urlBefore) {
    logs.documentUpdatedUnchangedUrl();
  } else if (urlAfter) {
    logs.documentUpdatedChangedUrl();
    await shortenUrl(after);
  } else if (urlBefore) {
    logs.documentUpdatedDeletedUrl();
    await updateShortUrl(after, admin.firestore.FieldValue.delete());
  } else {
    logs.documentUpdatedNoUrl();
  }
};

const shortenUrl = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const url = extractUrl(snapshot);
  logs.shortenUrl(url);

  try {
    const response = await bitly.shorten(url);
    const { url: shortUrl } = response;

    logs.shortenUrlComplete(shortUrl);

    await updateShortUrl(snapshot, shortUrl);
  } catch (err) {
    logs.error(err);
  }
};

const updateShortUrl = async (
  snapshot: admin.firestore.DocumentSnapshot,
  url: any
): Promise<void> => {
  logs.updateDocument(snapshot.ref.path);

  // Wrapping in transaction to allow for automatic retries (#48)
  await admin.firestore().runTransaction((transaction => {
    transaction.update(snapshot.ref, config.shortUrlFieldName, url);
    return Promise.resolve();
  }));

  logs.updateDocumentComplete(snapshot.ref.path);
};
