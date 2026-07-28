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

import type { Firestore } from "firebase-admin/firestore";
import type { ResolvedSendEmailConfig } from "./export-config";
import * as logs from "./logs";
import type { Templates } from "./templates";
import type { QueuePayload } from "./types";
import { attachmentsSchema, validatePayload } from "./validation";

export interface PreparePayloadDependencies {
  db: Firestore;
  config: ResolvedSendEmailConfig;
  templates?: Templates;
}

function validateFieldArray(field: string, array?: string[]) {
  if (!Array.isArray(array)) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }
  if (array.find((item) => typeof item !== "string")) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }
}

export async function preparePayload(
  payload: QueuePayload,
  { db, config, templates }: PreparePayloadDependencies
): Promise<QueuePayload> {
  validatePayload(payload);

  if (templates && payload.template) {
    if (!payload.template.name) {
      throw new Error("Template object is missing a 'name' parameter.");
    }

    const templateRender = await templates.render(
      payload.template.name,
      payload.template.data || {}
    );
    const mergeMessage = payload.message || {};
    const attachments = attachmentsSchema.parse(
      templateRender.attachments
        ? templateRender.attachments
        : mergeMessage.attachments
    );

    const handleTemplateValue = (value: unknown) => {
      if (value === null || value === undefined) return undefined;
      if (value === "") return "";
      return value || undefined;
    };

    const templateContent = {
      subject: handleTemplateValue(templateRender.subject),
      html: handleTemplateValue(templateRender.html),
      text: handleTemplateValue(templateRender.text),
      amp: handleTemplateValue(templateRender.amp),
      attachments: attachments || [],
    };

    Object.keys(templateContent).forEach((key) => {
      if (templateContent[key as keyof typeof templateContent] === undefined) {
        delete templateContent[key as keyof typeof templateContent];
      }
    });

    payload.message = Object.assign(mergeMessage, templateContent);
  }

  let to: string[] = [];
  let cc: string[] = [];
  let bcc: string[] = [];

  if (typeof payload.to === "string") {
    to = [payload.to];
  } else if (payload.to) {
    validateFieldArray("to", payload.to);
    to = to.concat(payload.to);
  }

  if (typeof payload.cc === "string") {
    cc = [payload.cc];
  } else if (payload.cc) {
    validateFieldArray("cc", payload.cc);
    cc = cc.concat(payload.cc);
  }

  if (typeof payload.bcc === "string") {
    bcc = [payload.bcc];
  } else if (payload.bcc) {
    validateFieldArray("bcc", payload.bcc);
    bcc = bcc.concat(payload.bcc);
  }

  if (!payload.toUids && !payload.ccUids && !payload.bccUids) {
    payload.to = to;
    payload.cc = cc;
    payload.bcc = bcc;
    return payload;
  }

  if (!config.usersCollection) {
    throw new Error("Must specify a users collection to send using uids.");
  }

  let uids: string[] = [];
  if (payload.toUids) {
    validateFieldArray("toUids", payload.toUids);
    uids = uids.concat(payload.toUids);
  }
  if (payload.ccUids) {
    validateFieldArray("ccUids", payload.ccUids);
    uids = uids.concat(payload.ccUids);
  }
  if (payload.bccUids) {
    validateFieldArray("bccUids", payload.bccUids);
    uids = uids.concat(payload.bccUids);
  }

  const toFetch: Record<string, string | null> = {};
  uids.forEach((uid) => {
    toFetch[uid] = null;
  });

  // TODO(migration): Preserve legacy behavior for empty UID arrays, which call
  // Firestore getAll() without document refs and throw.
  const documents = await db.getAll(
    ...Object.keys(toFetch).map((uid) =>
      db.collection(config.usersCollection as string).doc(uid)
    ),
    { fieldMask: ["email"] }
  );

  const missingUids: string[] = [];
  documents.forEach((documentSnapshot) => {
    if (documentSnapshot.exists) {
      const email = documentSnapshot.get("email");
      if (email) {
        toFetch[documentSnapshot.id] = email;
      } else {
        missingUids.push(documentSnapshot.id);
      }
    } else {
      missingUids.push(documentSnapshot.id);
    }
  });

  logs.missingUids(missingUids);

  payload.toUids?.forEach((uid) => {
    const email = toFetch[uid];
    if (email) to.push(email);
  });
  payload.ccUids?.forEach((uid) => {
    const email = toFetch[uid];
    if (email) cc.push(email);
  });
  payload.bccUids?.forEach((uid) => {
    const email = toFetch[uid];
    if (email) bcc.push(email);
  });

  payload.to = to;
  payload.cc = cc;
  payload.bcc = bcc;
  return payload;
}
