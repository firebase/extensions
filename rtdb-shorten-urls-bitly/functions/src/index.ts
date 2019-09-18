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

export const rtdburlshortener = functions.handler.database.ref.onWrite(
  async (change) => {
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

const extractUrl = (snapshot: admin.database.DataSnapshot) => {
  return snapshot.val()[config.urlFieldName];
};

const getChangeType = (
  change: functions.Change<admin.database.DataSnapshot>
) => {
  if (!change.after.exists()) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists()) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

const handleCreateDocument = async (snapshot: admin.database.DataSnapshot) => {
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
  before: admin.database.DataSnapshot,
  after: admin.database.DataSnapshot
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
  snapshot: admin.database.DataSnapshot
): Promise<void> => {
  const url = extractUrl(snapshot);

  try {
    logs.shortenUrl(url);
    const response = await bitly.shorten(url);
    // @ts-ignore incorrectly reporting that url does not exist
    const { url: shortUrl } = response;
    logs.shortenUrlComplete(shortUrl);

    await updateShortUrl(snapshot, shortUrl);
  } catch (err) {
    logs.error(err);
  }
};

const updateShortUrl = async (
  snapshot: admin.database.DataSnapshot,
  url: any
): Promise<void> => {
  logs.updateDocument(snapshot.ref.path);

  await snapshot.ref.update({
    [config.shortUrlFieldName]: url,
  });

  logs.updateDocumentComplete(snapshot.ref.path);
};
