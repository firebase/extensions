import { program } from "commander";
import admin from "firebase-admin";
import { DEFAULT_BATCH_SIZE, parseConfig } from "./config";
import { validateLanguages } from "./languages";
import { translateDocument } from "./translate";

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
    "-G --gc-project-id <gc-project-id>",
    "The Google Cloud project ID for the Translation API."
  )
  .option(
    "-C --collection-path <collection-path>",
    "The path of the Cloud Firestore Collection to translate."
  )
  .option(
    "-L --languages <languages>",
    "Target languages for translations, as a comma-separated list."
  )
  .option(
    "-I --input-field-name <input-field-name>",
    "The name of the field that contains the string that you want to translate."
  )
  .option(
    "-O --output-field-name <output-field-name>",
    "The name of the field where you want to store your translations."
  )
  .option(
    "-N --languages-field-name <languages-field-name>",
    "The name of the field that contains the languages that you want to translate into."
  )
  .option(
    "--batch-size <batch-size>",
    "The number of documents to process in each batch.",
    `${DEFAULT_BATCH_SIZE}`
  )
  .option(
    "--multi-threaded <multi-threaded>",
    "Whether to run the script across multiple threads.",
    false
  )
  .action(run)
  .parseAsync(process.argv);

async function run(options: any) {
  const config = await parseConfig(options);
  const {
    projectId,
    gcProjectId,
    collectionPath,
    languages,
    inputFieldName,
    outputFieldName,
    languagesFieldName,
  } = config;

  const validation = validateLanguages(languages);
  if (validation !== true) program.error(validation);

  // Initialize Firebase
  const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  const db = app.firestore();
  const collection = db.collection(collectionPath);
  const snapshot = await collection.get();
  const docs = snapshot.docs;

  try {
    await Promise.all(
      docs.map((doc) =>
        translateDocument(
          gcProjectId,
          doc,
          languages,
          inputFieldName,
          outputFieldName,
          languagesFieldName
        )
      )
    );
  } catch (e) {
    console.log(e);
  }
}
