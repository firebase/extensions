import { DocumentData } from "firebase-admin/firestore";
import { validatePayload, validatePreparedPayload } from "./validation";
import * as logs from "./logs";
import config from "./config";

let db: any;
let templates: any;

export function setDependencies(database: any, templatesInstance: any) {
  db = database;
  templates = templatesInstance;
}

/**
 * Normalizes recipient field to an array of strings.
 */
const normalizeRecipients = (value: string | string[] | undefined): string[] =>
  typeof value === "string" ? [value] : value || [];

/**
 * Resolves UIDs to email addresses using a pre-fetched email map.
 */
const resolveUidsToEmails = (
  uids: string[] | undefined,
  emailMap: Record<string, string | null>
): string[] =>
  (uids || [])
    .map((uid) => emailMap[uid])
    .filter((email): email is string => !!email);

export async function preparePayload(
  payload: DocumentData
): Promise<DocumentData> {
  validatePayload(payload);

  const { template } = payload;

  if (templates && template) {
    if (!template.name) {
      throw new Error(`Template object is missing a 'name' parameter.`);
    }

    const templateRender = await templates.render(template.name, template.data);
    const mergeMessage = payload.message || {};

    const attachments = templateRender.attachments
      ? templateRender.attachments
      : mergeMessage.attachments;

    // Convert null to undefined so it doesn't overwrite existing values
    const handleTemplateValue = (value: any) =>
      value === null ? undefined : value;

    const templateContent = Object.fromEntries(
      Object.entries({
        subject: handleTemplateValue(templateRender.subject),
        html: handleTemplateValue(templateRender.html),
        text: handleTemplateValue(templateRender.text),
        amp: handleTemplateValue(templateRender.amp),
        attachments: attachments || [],
      }).filter(([_, v]) => v !== undefined)
    );

    payload.message = Object.assign(mergeMessage, templateContent);
  }

  let to = normalizeRecipients(payload.to);
  let cc = normalizeRecipients(payload.cc);
  let bcc = normalizeRecipients(payload.bcc);

  if (!payload.toUids && !payload.ccUids && !payload.bccUids) {
    payload.to = to;
    payload.cc = cc;
    payload.bcc = bcc;
    return validatePreparedPayload(payload);
  }

  if (!config.usersCollection) {
    throw new Error("Must specify a users collection to send using uids.");
  }

  let uids: string[] = [];

  if (payload.toUids) {
    uids = uids.concat(payload.toUids);
  }

  if (payload.ccUids) {
    uids = uids.concat(payload.ccUids);
  }

  if (payload.bccUids) {
    uids = uids.concat(payload.bccUids);
  }

  const toFetch: Record<string, string | null> = {};
  uids.forEach((uid) => (toFetch[uid] = null));

  const documents = await db.getAll(
    ...Object.keys(toFetch).map((uid) =>
      db.collection(config.usersCollection).doc(uid)
    ),
    {
      fieldMask: ["email"],
    }
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

  payload.to = to.concat(resolveUidsToEmails(payload.toUids, toFetch));
  payload.cc = cc.concat(resolveUidsToEmails(payload.ccUids, toFetch));
  payload.bcc = bcc.concat(resolveUidsToEmails(payload.bccUids, toFetch));

  return validatePreparedPayload(payload);
}
