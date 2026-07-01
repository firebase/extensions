import * as eventArc from "firebase-admin/eventarc";

const EXTENSION_NAME = "storage-resize-images";

const getEventType = (eventName: string): string =>
  `firebase.extensions.${EXTENSION_NAME}.v1.${eventName}`;

let eventChannel: eventArc.Channel | undefined;

export const setupEventChannel = (): void => {
  eventChannel = process.env.EVENTARC_CHANNEL
    ? eventArc.getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

export const recordStartEvent = async (
  data: string | object
): Promise<unknown> => {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onStart"),
    data,
  });
};

export const recordErrorEvent = async (err: Error): Promise<unknown> => {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onError"),
    data: { message: err.message },
  });
};

export const recordSuccessEvent = async ({
  subject,
  data,
}: {
  subject: string;
  data: string | object;
}): Promise<unknown> => {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onSuccess"),
    subject,
    data,
  });
};

export const recordCompletionEvent = async (
  data: string | object
): Promise<unknown> => {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onCompletion"),
    data,
  });
};

export const recordStartResizeEvent = async ({
  subject,
  data,
}: {
  subject: string;
  data: string | object;
}): Promise<unknown> => {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onStartResize"),
    subject,
    data,
  });
};
