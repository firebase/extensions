import { program } from "commander";
import { parseConfig } from "./config";
import firebase from "firebase-admin";
import googleTranslate from "@google-cloud/translate";

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
  const {
    projectId,
    languages,
    collectionPath,
    inputFieldName,
    outputFieldName,
  } = config;

  // Initialize Firebase
  const app = firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  const db = app.firestore();
  const collection = db.collection(collectionPath);
  const snapshot = await collection.get();
  const docs = snapshot.docs;

  const translate = new googleTranslate.v2.Translate();

  for (const doc of docs) {
    const input = doc.get(inputFieldName);
    try {
      const output = await translate.translate(input, { to: languages[0] });
      await doc.ref.update({ [outputFieldName]: output });
    } catch (e) {
      console.log(e);
    }
  }
}
