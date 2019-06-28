import * as httpErrors from "./errors";
import * as logs from "./logs";

export const pathExists = (path?: string) => {
  if (!path) {
    logs.pathMissing();
    throw httpErrors.invalidArgument("path");
  }
};

export const userHasClaim = (token) => {
  const hasCustomClaim = token && token.fsdelete;
  if (!hasCustomClaim) {
    logs.userMissingClaim();
    throw httpErrors.permissionDenied();
  }
};

export const userIsAuthenticated = (auth) => {
  const isAuthenticated = auth && auth.uid;
  if (!isAuthenticated) {
    logs.userUnauthenticated();
    throw httpErrors.unauthenticated();
  }
};
