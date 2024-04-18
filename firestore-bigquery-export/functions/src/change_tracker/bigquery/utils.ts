export function parseErrorMessage(
  error: unknown,
  process: string = ""
): string {
  let message: string;

  if (error instanceof Error) {
    // Standard error handling
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    // Handling errors from APIs or other sources that are not native Error objects
    message = (error as { message: string }).message;
  } else {
    // Fallback for when error is neither an Error object nor an expected structured object
    message = `An unexpected error occurred${
      process ? ` during ${process}` : ""
    }.`;
  }
  return message;
}
