import * as eventArc from "firebase-admin/eventarc";

let eventChannel: eventArc.Channel | undefined;

export const setupEventChannel = (): void => {
  eventChannel = process.env.EVENTARC_CHANNEL
    ? eventArc.getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      })
    : undefined;
};

export async function publishDeletionEvent(
  target: "firestore" | "database" | "storage",
  data: object
): Promise<unknown> {
  if (!eventChannel) return Promise.resolve();
  return eventChannel.publish({
    type: `firebase.extensions.delete-user-data.v1.${target}`,
    data,
  });
}
