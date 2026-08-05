import * as eventArc from "firebase-admin/eventarc";

const EXTENSION_NAME = "firestore-vector-search";

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

export async function recordStartEvent(data: object): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({ type: getEventType("onStart"), data });
}

export async function recordErrorEvent(err: Error): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onError"),
    data: { message: err.message },
  });
}

export async function recordSuccessEvent(params: {
  subject: string;
  data: object;
}): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: getEventType("onSuccess"),
    subject: params.subject,
    data: params.data,
  });
}

export async function recordCompletionEvent(data: object): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({ type: getEventType("onCompletion"), data });
}
