import { GoogleError } from "google-gax";

interface GoogleErrorWithReason extends GoogleError {
  reason: string;
}

function isGoogleErrorWithReason(e: Error): e is GoogleErrorWithReason {
  return (e as GoogleErrorWithReason).reason !== undefined;
}

enum GoogleErrorReason {
  ACCESS_TOKEN_SCOPE_INSUFFICIENT = "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
}

export function createErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) {
    return "Unknown Error. Please look to function logs for more details.";
  }

  if (isGoogleErrorWithReason(e)) {
    switch (e.reason) {
      case GoogleErrorReason.ACCESS_TOKEN_SCOPE_INSUFFICIENT:
        return "The project or service account likely does not have access to the Gemini API.";
      default:
        return `An error occurred while processing the provided message, ${e.message}`;
    }
  }
  return `An error occurred while processing the provided message, ${e.message}`;
}
