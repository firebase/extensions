import * as eventArc from "firebase-admin/eventarc";

const { getEventarc } = eventArc;

const EXTENSION_NAME = "firestore-counter";

const getEventType = (eventName: string) =>
  `firebase.extensions.${EXTENSION_NAME}.v1.${eventName}`;

let eventChannel: eventArc.Channel;

/** setup events */
export const setupEventChannel = () => {
  eventChannel =
    process.env.EVENTARC_CHANNEL &&
    getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    });
};

export const recordStartEvent = async (data: string | object) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: getEventType("onStart"),
    data,
  });
};

export const recordErrorEvent = async (err: Error, subject?: string) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: getEventType("onError"),
    data: { message: err.message },
    subject,
  });
};

export const recordSuccessEvent = async ({
  subject,
  data,
}: {
  subject: string;
  data: string | object;
}) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: getEventType("onSuccess"),
    subject,
    data,
  });
};

export const recordCompletionEvent = async (data: string | object) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: getEventType("onCompletion"),
    data,
  });
};
