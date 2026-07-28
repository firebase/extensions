import { Channel, getEventarc } from "firebase-admin/eventarc";

let eventChannel: Channel | undefined;

/** setup events */
export const setupEventChannel = () => {
  eventChannel =
    process.env.EVENTARC_CHANNEL &&
    getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    });
};

export const recordStartEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onStart",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordProcessingEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onProcessing",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordErrorEvent = async (change, doc, err) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onError",
    subject: change.after.id,
    data: { doc, err },
  });
};

export const recordSuccessEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onSuccess",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordCompleteEvent = async (change) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onComplete",
    subject: change.after.id,
    data: { doc: change.after },
  });
};

export const recordPendingEvent = async (change, doc) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onPending",
    subject: change.after.id,
    data: { doc },
  });
};

export const recordRetryEvent = async (change, doc) => {
  if (!eventChannel) return;

  return eventChannel.publish({
    type: "firebase.extensions.firestore-send-email.v1.onRetry",
    subject: change.after.id,
    data: { doc },
  });
};
