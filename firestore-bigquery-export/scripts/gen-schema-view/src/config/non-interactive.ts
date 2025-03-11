import program from "commander";

/**
 * Helper function to collect multiple values for an option into an array
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Configure the commander program with all needed options
 */
export const configureProgram = () => {
  const packageJson = require("../../package.json");

  program
    .name("gen-schema-views")
    .description(packageJson.description)
    .version(packageJson.version)
    .option(
      "--non-interactive",
      "Parse all input from command line flags instead of prompting the caller.",
      false
    )
    .option(
      "-P, --project <project>",
      "Firebase Project ID for project containing Cloud Firestore database."
    )
    .option(
      "-B, --big-query-project <big-query-project>",
      "Google Cloud Project ID for BigQuery (can be the same as the Firebase project ID)."
    )
    .option(
      "-d, --dataset <dataset>",
      "The ID of the BigQuery dataset containing a raw Cloud Firestore document changelog."
    )
    .option(
      "-t, --table-name-prefix <table-name-prefix>",
      "A common prefix for the names of all views generated by this script."
    )
    .option(
      "-f, --schema-files <schema-files>",
      "A collection of files from which to read schemas.",
      collect,
      []
    )
    .option(
      "-g, --use-gemini <collection-path>",
      "Use Gemini to automatically analyze your data and generate a draft schema. You will have a chance to manually view and approve this schema before it is used."
    )
    .option(
      "--schema-dir <directory>",
      "Directory to store generated schemas",
      "./schemas"
    )
    .option("--google-ai-key <key>", "Google AI API Key for Gemini");

  return program;
};

/**
 * Parse command line arguments
 */
export const parseProgram = () => {
  const prog = configureProgram();
  prog.parse(process.argv);
  return prog;
};

/**
 * Validate required non-interactive parameters are present
 * @returns {boolean} true if all required parameters are present
 */
export const validateNonInteractiveParams = (program: any): boolean => {
  return !(
    program.project === undefined ||
    program.dataset === undefined ||
    program.tableNamePrefix === undefined ||
    program.schemaFiles.length === 0 ||
    program.useGemini === ""
  );
};
