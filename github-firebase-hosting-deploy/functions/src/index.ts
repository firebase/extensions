/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as fs from "fs-extra";
import { sha256 } from "js-sha256";
import fetch from "node-fetch";
import { Clone, Tree } from "nodegit";
import { gzip } from "pako";

import config from "./config";
import * as constants from "./constants";
import * as logs from "./logs";

type Manifest = {
  content: { [hash: string]: Uint8Array };
  files: { [path: string]: string };
};

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();

// Receive a GitHub webhook, check the repository out, and get a list of files
// in the deploy directory, then call publish() asynchronously.
export const deploy = functions.handler.https.onRequest(async (req, res) => {
  logs.start();

  const { body } = req;
  const { after, ref } = body;

  if (ref !== `refs/heads/${config.branch}`) {
    logs.branchSkip(ref, config.branch);
    res
      .status(200)
      .send(`Not the right ref. "${ref}" vs "refs/heads/${config.branch}"`);
    return;
  }

  const basedir = `/tmp/${after}`;
  try {
    if (!fs.existsSync(basedir)) {
      fs.mkdirSync(basedir);
    }

    logs.accessTokenLoading();
    const accessToken = await admin.credential
      .applicationDefault()
      .getAccessToken(); //await getAccessToken();
    logs.accessTokenLoaded();

    logs.repositoryCloning(config.repository, basedir);
    const repo = await Clone.clone(config.repository, basedir);
    logs.repositoryCloned(config.repository, basedir);

    logs.commitLoading(after);
    const commit = await repo.getCommit(after);
    logs.commitLoaded(after);

    const tree = await commit.getTree();
    const paths = await getFilePaths(tree);

    logs.filesPublishing();
    await publishFiles(basedir, paths, accessToken.access_token);
    logs.filesPublished();

    logs.complete();
    res.status(200).send("Deployed!");
  } catch (err) {
    logs.error(err);
    res.status(500).send(JSON.stringify(err));
  } finally {
    try {
      // Make sure all local files are cleaned up to free up disk space.
      logs.tempFilesDeleting();
      fs.emptyDirSync(basedir);
      fs.rmdirSync(basedir);
      logs.tempFilesDeleted();
    } catch (err) {
      logs.errorDeleting(err);
    }
  }
});

const getFilePaths = (tree: Tree): Promise<string[]> => {
  return new Promise((resolve) => {
    const walker = tree.walk();
    walker.on("end", (entries) => {
      const paths = entries.map((entry) => entry.path());
      resolve(paths);
    });
    walker.start();
  });
};

const publishFiles = async (
  basedir: string,
  paths: string[],
  token: string
): Promise<void> => {
  const manifest = buildManifest(basedir, paths);
  logs.deploymentManifest(JSON.stringify(manifest));

  logs.versionLoading();
  const version = await api(
    "POST",
    `sites/${config.siteName}/versions`,
    token,
    {
      config: {},
    }
  );
  logs.versionLoaded(version.name);

  logs.requestedFilesLoading();
  const toUpload = await api("POST", `${version.name}:populateFiles`, token, {
    files: manifest.files,
  });
  logs.requestedFilesLoaded(JSON.stringify(toUpload));

  const { uploadRequiredHashes, uploadUrl } = toUpload;
  for (const hash of uploadRequiredHashes || []) {
    const contentToUpload = manifest.content[hash];
    logs.fileUploading(hash);
    await uploadFile(`${uploadUrl}/${hash}`, token, contentToUpload);
    logs.fileUploaded(hash);
  }

  logs.uploadFinalizing();
  await api("PATCH", `${version.name}?update_mask=status`, token, {
    status: "FINALIZED",
  });
  logs.uploadFinalized();

  logs.releasing(version.name);
  await api(
    "POST",
    `sites/${config.siteName}/releases?version_name=${version.name}`,
    token,
    { message: "released by Firebase Mods CI" }
  );
  logs.released(version.name);
};

const buildManifest = (basedir: string, paths: string[]): Manifest => {
  const rv = { files: {}, content: {} };

  paths.forEach((tmpPath) => {
    if (
      tmpPath.split("/")[0] != config.deployRoot ||
      tmpPath.split("/").length < 2
    ) {
      return;
    }
    const path = "/" + tmpPath.split("/", 2)[1];

    const fsPath = `${basedir}/${tmpPath}`;
    const content = fs.readFileSync(fsPath);
    const data = gzip(content, { level: 9 });
    const hash = sha256(data);

    rv.files[path] = hash;
    rv.content[hash] = data;
  });

  return rv;
};

const uploadFile = async (
  url: string,
  token: string,
  body: any
): Promise<void> => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
  };
  await fetch(url, {
    method: "POST",
    body,
    headers,
  });
};

const api = async (
  method: string,
  path: string,
  token: string,
  body: string | object = null
): Promise<any> => {
  const url = path.indexOf("://") >= 0 ? path : `${constants.API_ROOT}${path}`;

  if (typeof body !== "string") {
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method,
  });

  if (response.status >= 400) {
    let details;
    try {
      details = await response.json();
    } catch (e) {
      details = {
        error: {
          status: "INTERNAL",
          code: response.status,
          message: "Unknown HTTP error, invalid JSON response.",
        },
      };
    }

    const err = new Error(`${details.error.status}: ${details.error.message}`);
    // @ts-ignore
    err.details = details;
    throw err;
  }

  return await response.json();
};
