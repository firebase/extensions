import * as admin from "firebase-admin";
import * as httpErrors from "./errors";
import * as logs from "./logs";

export const docPathFieldValid = (docPath: string, field: string) => {
  const valid = docPath && field;
  if (!valid) {
    logs.docPathFieldInvalid(docPath, field);
    throw httpErrors.invalidDocPathField();
  }
};

export const invitationExists = (
  snapshot: admin.firestore.DocumentSnapshot,
  invitationId: string
) => {
  const { exists } = snapshot;
  if (!exists) {
    logs.invitationDoesNotExist(invitationId);
    throw httpErrors.missingToken();
  }
};

export const userIsAuthenticated = (auth) => {
  const isAuthenticated = auth && auth.uid;
  if (!isAuthenticated) {
    logs.userUnauthenticated();
    throw httpErrors.unauthenticated();
  }
};
