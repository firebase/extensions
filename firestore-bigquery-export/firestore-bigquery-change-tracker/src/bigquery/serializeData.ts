import * as traverse from "traverse";
import { DocumentReference } from "firebase-admin/firestore";

// TODO: type this any
export function serializeData(eventData: any) {
  if (typeof eventData === "undefined") {
    return undefined;
  }

  const data = traverse<traverse.Traverse<any>>(eventData).map(function (
    property
  ) {
    if (property && property.constructor) {
      if (property.constructor.name === "Buffer") {
        this.remove();
      }

      if (property.constructor.name === DocumentReference.name) {
        this.update(property.path);
      }
    }
  });

  return data;
}
