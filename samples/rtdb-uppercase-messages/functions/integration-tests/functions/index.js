import { logger } from "firebase-functions/v1";
import { onCustomEventPublished } from "firebase-functions/v2/eventarc";

import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const app = initializeApp();

export const extraemphasis = onCustomEventPublished(
  "test-publisher.rtdb-uppercase-messages.v1.complete",
  async (event) => {
    logger.info("Received makeuppercase completed event", event);

    const refUrl = event.subject;
    const ref = getDatabase().refFromURL(refUrl);
    const upper = (await ref.get()).val();
    return ref.set(`${upper}!!!`);
  }
);
