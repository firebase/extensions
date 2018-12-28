/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const { gzip, inflate } = require("pako");
const { sha256 } = require("js-sha256");
const fetch = require("node-fetch");
const fs = require("fs");
const functions = require("firebase-functions");
const Git = require("nodegit");
const googleAuth = require("google-auto-auth");

const authScopes = ["https://www.googleapis.com/auth/firebase"];
const API_ROOT = "https://firebasehosting.googleapis.com/v1beta1/";

const sitename = process.env.SITE_NAME;
const repository = process.env.REPO;
const branch = process.env.BRANCH;
const deployRoot = process.env.DEPLOY_ROOT;

// Receive a GitHub webhook, check the repository out, and get a list of files
// in the deploy directory, then call publish() asynchronously.
exports.deploy = functions.https.onRequest((req, res) => {
  console.log(req.body);

  if (req.body.ref !== `refs/heads/${branch}`) {
    return res
      .send(`Not the right ref. "${req.body.ref}" vs "refs/heads/${branch}"`)
      .end();
  }

  const commit = req.body.after;

  const basedir = `/tmp/${commit}`;
  if (!fs.existsSync(basedir)) {
    fs.mkdirSync(basedir);
  }

  return googleAuth({ scopes: authScopes }).getToken((err, oa2token) => {
    Git.Clone(repository, basedir)
      .then((repo) => repo.getCommit(commit))
      .then((commit) => commit.getTree())
      .then((tree) => {
        return new Promise((resolve) => {
          const walker = tree.walk();
          walker.on("end", (entries) => {
            paths = entries.map((entry) => entry.path());
            publish(basedir, paths, oa2token).then(resolve);
          });
          walker.start();
        });
      })
      .then(() => {
        res.send("Deployed!").end();
      });
  });
});

async function publish(basedir, paths, oa2token) {
  console.log(`Authenticating to GAPIs with token`);

  const files = handlePaths(basedir, paths);
  console.log(`Deployment manifest: ${JSON.stringify(files)}`);

  const version = await api("POST", `sites/${sitename}/versions`, oa2token, {
    config: {},
  });
  const toUpload = await api("populateFiles", version.name, oa2token, {
    files: files.files,
  });
  console.log(`Requested files: ${JSON.stringify(toUpload)}`);
  const uploadUrl = toUpload.uploadUrl;
  for (const hash of toUpload.uploadRequiredHashes || []) {
    const contentToUpload = files.content[hash];
    await upload(`${uploadUrl}/${hash}`, oa2token, contentToUpload);
    console.log(`Uploaded hash: ${hash}`);
  }

  const finalizeResponse = await api(
    "PATCH",
    `${version.name}?update_mask=status`,
    oa2token,
    { status: "FINALIZED" }
  );
  console.log(`Finalized: ${JSON.stringify(finalizeResponse)}`);

  const releaseResponse = await api(
    "POST",
    `sites/${sitename}/releases?version_name=${version.name}`,
    oa2token,
    { message: "released by Firebase Mods CI" }
  );
  console.log(`Released: ${JSON.stringify(releaseResponse)}`);
}

function handlePaths(basedir, paths) {
  const rv = { files: {}, content: {} };

  for (const tmpPath of paths) {
    if (tmpPath.split("/")[0] != deployRoot || tmpPath.split("/").length < 2) {
      continue;
    }
    const path = "/" + tmpPath.split("/", 2)[1];

    const fsPath = `${basedir}/${tmpPath}`;
    const content = fs.readFileSync(fsPath);
    const data = gzip(content, { level: 9 });
    const hash = sha256(data);

    rv.files[path] = hash;
    rv.content[hash] = data;
  }

  return rv;
}

async function upload(url, token, content) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
  };
  console.log(headers);
  const response = await fetch(url, {
    method: "POST",
    body: content,
    headers: headers,
  });
  console.log(response);
}

async function api(method, name, token, body = null, options = {}) {
  let httpMethod = method;
  let apiMethod = "";

  if (!["GET", "POST", "PATCH"].includes(method)) {
    httpMethod = "POST";
    apiMethod = `:${method}`;
  }

  const url = name.indexOf("://") >= 0 ? name : API_ROOT + name + apiMethod;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (typeof body !== "string") {
    body = JSON.stringify(body);
  }

  console.log(`${httpMethod} ${url} ${JSON.stringify(body)}`);

  const response = await fetch(url, {
    method: httpMethod,
    headers,
    body,
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
    err.details = details;
    throw err;
  }

  return await response.json();
}
