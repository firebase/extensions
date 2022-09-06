import admin from "firebase-admin";
import { translateDocument } from "../translate";

const options = {
  projectId: "dev-extensions-testing",
  gcProjectId: "dev-extensions-testing",
  collectionPath: "comments",
  languages: ["es", "fr"],
  inputFieldName: "comments",
  outputFieldName: "output",
  languagesFieldName: "languages",
};

describe("translate-collection", () => {
  let db: admin.firestore.Firestore;

  beforeAll(() => {
    const app = admin.initializeApp({ projectId: options.projectId });
    db = app.firestore();
  });

  it("translates string input using the languages option", async () => {
    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: "Hi, how are you?",
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toBeDefined();
    options.languages.forEach((language) => {
      expect(output).toHaveProperty(language);
    });
  });

  it("translates string input using the languages field", async () => {
    const languages = ["ar", "tr"];

    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: "Hi, how are you?",
      [options.languagesFieldName]: languages,
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName,
      options.languagesFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toBeDefined();
    languages.forEach((language) => {
      expect(output).toHaveProperty(language);
    });
  });

  it("translates map input using the languages option", async () => {
    const input = {
      subject: "Hello",
      body: "Hi, how are you?",
    };

    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: input,
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toBeDefined();
    Object.keys(input).forEach((key) => {
      expect(output).toHaveProperty(key);
      options.languages.forEach((language) => {
        expect(output).toHaveProperty([key, language]);
      });
    });
  });

  it("translates map input using the languages field", async () => {
    const input = {
      subject: "Hello",
      body: "Hi, how are you?",
    };
    const languages = ["ar", "tr"];

    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: input,
      [options.languagesFieldName]: languages,
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName,
      options.languagesFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toBeDefined();
    Object.keys(input).forEach((key) => {
      expect(output).toHaveProperty(key);
      languages.forEach((language) => {
        expect(output).toHaveProperty([key, language]);
      });
    });
  });

  it("falls back to LANGUAGES option if languagesField is not present", async () => {
    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: "Hi, how are you?",
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName,
      options.languagesFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toBeDefined();
    options.languages.forEach((language) => {
      expect(output).toHaveProperty(language);
    });
  });
  it("skips translation if the input field is an empty array", async () => {
    const collection = db.collection(options.collectionPath);
    const doc = await collection.add({
      [options.inputFieldName]: "Hi, how are you?",
      [options.languagesFieldName]: [],
    });
    const snapshot = await doc.get();
    await translateDocument(
      options.gcProjectId,
      snapshot,
      options.languages,
      options.inputFieldName,
      options.outputFieldName,
      options.languagesFieldName
    );

    const updatedDoc = await doc.get();
    const output = updatedDoc.get(options.outputFieldName);

    expect(output).toEqual({});
  });
});
