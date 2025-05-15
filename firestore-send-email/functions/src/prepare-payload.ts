import { DocumentData } from "firebase-admin/firestore";
import { validatePayload } from "./validation";
import * as logs from "./logs";
import config from "./config";

let db: any;
let templates: any;

export function setDependencies(database: any, templatesInstance: any) {
  db = database;
  templates = templatesInstance;
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
  payload: DocumentData
): Promise<DocumentData> {
  console.log("Step 1: Starting preparePayload with payload:", payload);

  // Validate the payload before processing
  console.log("Step 2: Validating payload");
  validatePayload(payload);

  const { template } = payload;
  console.log("Step 3: Template from payload:", template);
  console.log("Step 4: Templates instance exists:", !!templates);

  if (templates && template) {
    console.log("Step 5: Processing template");

    if (!template.name) {
      throw new Error(`Template object is missing a 'name' parameter.`);
    }

    console.log("Step 6: Rendering template:", template.name);
    const templateRender = await templates.render(template.name, template.data);
    console.log("Step 7: Template render result:", templateRender);

    const mergeMessage = payload.message || {};
    console.log("Step 8: Message to merge with:", mergeMessage);

    const attachments = templateRender.attachments
      ? templateRender.attachments
      : mergeMessage.attachments;

    // Helper function to handle null/empty string logic
    const handleTemplateValue = (value: any) => {
      if (value === null) {
        return undefined; // null means don't include the property
      }
      if (value === "") {
        return ""; // Empty string is preserved
      }
      if (value === undefined) {
        return undefined; // undefined means don't overwrite
      }
      return value || undefined; // For other falsy values, convert to undefined
    };

    // Only include values that should be applied from templateRender
    const templateContent = {
      subject: handleTemplateValue(templateRender.subject),
      html: handleTemplateValue(templateRender.html),
      text: handleTemplateValue(templateRender.text),
      amp: handleTemplateValue(templateRender.amp),
      attachments: attachments || [],
    };

    // Remove undefined values to prevent Object.assign from overwriting
    Object.keys(templateContent).forEach((key) => {
      if (templateContent[key] === undefined) {
        delete templateContent[key];
      }
    });

    payload.message = Object.assign(mergeMessage, templateContent);
    console.log("Step 9: Merged message result:", payload.message);
  }

  let to: string[] = [];
  let cc: string[] = [];
  let bcc: string[] = [];

  console.log("Step 10: Processing recipient addresses");
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

  console.log("Step 11: Processed recipients:", { to, cc, bcc });

  if (!payload.toUids && !payload.ccUids && !payload.bccUids) {
    console.log("Step 12: No UIDs to process, returning with direct addresses");
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

  console.log("Step 13: Processing UIDs:", uids);

  const toFetch: Record<string, string | null> = {};
  uids.forEach((uid) => (toFetch[uid] = null));

  console.log("Step 14: Fetching user documents");
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

  console.log("Step 15: User document fetch results:", {
    toFetch,
    missingUids,
  });
  logs.missingUids(missingUids);

  if (payload.toUids) {
    payload.toUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        to.push(email);
      }
    });
  }

  payload.to = to;

  if (payload.ccUids) {
    payload.ccUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        cc.push(email);
      }
    });
  }

  payload.cc = cc;

  if (payload.bccUids) {
    payload.bccUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        bcc.push(email);
      }
    });
  }

  payload.bcc = bcc;

  console.log("Step 16: Final payload:", payload);

  return payload;
}
