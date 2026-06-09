import * as admin from "firebase-admin";
import axios from "axios";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-experimental";

/** initialize */
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-experimental" });
}

const extractObjectfromBuffer = ($) => {
  const splitBuffers = $.toString().replace(/[\d]+[{]+/g, ",{");
  const formatted = splitBuffers.toString().substring(1);
  return JSON.parse(`[${formatted.toString()}]`);
};

const extName = "ext-firestore-bundle-builder-serve";
const domain = `http://localhost:5001/demo-experimental/us-central1/${extName}/`;
const hostedDomain = `http://localhost:8081/`;

const extUrl = (bundle) => `${domain}/bundles/${bundle}`;
const extHostedUrl = (bundle) => `${hostedDomain}/bundles/${bundle}`;

describe("functions", () => {
  it("successfully returns a bundle with queries, documents and params combined", async () => {
    const bundleName = "documents-queries-params";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(2);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("successfully returns a bundle using a query with a collection", async () => {
    const bundleName = "query-with-a-collection";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(2);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("successfully returns a bundle using a query with a collection and condition", async () => {
    const bundleName = "query-with-a-collection-and-condition";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(1);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("successfully returns a bundle using a query with a collection and where clause", async () => {
    const bundleName = "query-with-a-collection-and-condition";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(1);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  xit("successfully returns a bundle using a query with a collection and multiple where clauses", async () => {
    const bundleName = "query-with-a-collection-and-multiple-where-conditions";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(1);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("successfully returns a bundle using a document", async () => {
    const bundleName = "single-document";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(1);

    /*** check document metadata */
    expect(documentMetadata.documentMetadata.name).toEqual(
      "projects/demo-experimental/databases/(default)/documents/documents/document1"
    );

    /*** check document */
    expect(document.document.name).toEqual(
      "projects/demo-experimental/databases/(default)/documents/documents/document1"
    );
  });

  it("successfully returns a bundle using multiple documents", async () => {
    const bundleName = "multiple-documents";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(2);

    /*** check document metadata */
    /**TODO: not working */
    // expect(documentMetadata.documentMetadata.name).toEqual(
    //   "projects/demo-experimental/databases/(default)/documents/documents/document2"
    // );

    /*** check document */
    // expect(document.document.name).toEqual(
    //   "projects/demo-experimental/databases/(default)/documents/documents/document1"
    // );
  });

  it("successfully returns a bundle using params", async () => {
    const bundleName = "query-with-param";
    const url = extUrl(bundleName) + "?name=document2";
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(1);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("successfully returns a bundle using clientCache", async () => {
    const bundleName = "with-client-cache";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(0);
  });

  xit("successfully returns a bundle using serverCache", async () => {
    const bundleName = "with-server-cache";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(0);
  });

  xit("successfully returns a bundle using fileCache", async () => {
    const bundleName = "with-file-cache";
    const url = extUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(0);
  });

  xit("successfully returns a request through a webiste hosted by Firebase", async () => {
    const bundleName = "documents-queries-params";
    const url = extHostedUrl(bundleName);
    const { data: bundle } = await axios(url);

    const [metadata, documentMetadata, document] =
      extractObjectfromBuffer(bundle);

    /*** check metadata */
    expect(metadata.metadata.id).toEqual(bundleName);
    expect(metadata.metadata.totalDocuments).toEqual(2);

    /*** check document metadata */
    expect(documentMetadata.namedQuery.name).toEqual("example");

    /*** check document */
    expect(document.documentMetadata.queries[0]).toEqual("example");
  });

  it("returns a 404 response if an unknown bundle is provided", async () => {
    const bundleName = "unknown-bundle";
    const url = extHostedUrl(bundleName);

    return axios(url)
      .then(() => {
        fail("should not succeed");
      })
      .catch((ex) => {
        expect(ex.response.status).toEqual(404);
      });
  });
});
