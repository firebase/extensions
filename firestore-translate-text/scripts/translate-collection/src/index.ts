import { program } from "commander";
import { parseConfig } from "./config";

const packageJson = require("../package.json");

program
  .name(packageJson.name)
  .version(packageJson.version)
  .description(packageJson.description)
  .option(
    "--non-interactive",
    "Parse all input from command line flags instead of prompting the caller.",
    false
  )
  .option("-P --project-id <project-id>", "The Firebase project ID.")
  .option(
    "-L --languages <languages>",
    "Target languages for translations, as a comma-separated list."
  )
  .option(
    "-C --collection-path <collection-path>",
    "The path of the Cloud Firestore Collection to translate."
  )
  .option(
    "-I --input-field-name <input-field-name>",
    "The name of the field that contains the string that you want to translate."
  )
  .option(
    "-O --output-field-name <output-field-name>",
    "The name of the field where you want to store your translations."
  )
  .action(run)
  .parseAsync(process.argv);

async function run(options: any) {
  const config = await parseConfig(options);
}
