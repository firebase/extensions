"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const fs = require("fs-extra");
const js_sha256_1 = require("js-sha256");
const node_fetch_1 = require("node-fetch");
const nodegit_1 = require("nodegit");
const pako_1 = require("pako");
const config_1 = require("./config");
const constants = require("./constants");
const logs = require("./logs");
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
// Receive a GitHub webhook, check the repository out, and get a list of files
// in the deploy directory, then call publish() asynchronously.
exports.deploy = functions.handler.https.onRequest((req, res) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { body } = req;
    const { after, ref } = body;
    if (ref !== `refs/heads/${config_1.default.branch}`) {
        logs.branchSkip(ref, config_1.default.branch);
        res
            .status(200)
            .send(`Not the right ref. "${ref}" vs "refs/heads/${config_1.default.branch}"`);
        return;
    }
    const basedir = `/tmp/${after}`;
    try {
        if (!fs.existsSync(basedir)) {
            fs.mkdirSync(basedir);
        }
        logs.accessTokenLoading();
        const accessToken = yield admin.credential
            .applicationDefault()
            .getAccessToken(); //await getAccessToken();
        logs.accessTokenLoaded();
        logs.repositoryCloning(config_1.default.repository, basedir);
        const repo = yield nodegit_1.Clone.clone(config_1.default.repository, basedir);
        logs.repositoryCloned(config_1.default.repository, basedir);
        logs.commitLoading(after);
        const commit = yield repo.getCommit(after);
        logs.commitLoaded(after);
        const tree = yield commit.getTree();
        const paths = yield getFilePaths(tree);
        logs.filesPublishing();
        yield publishFiles(basedir, paths, accessToken.access_token);
        logs.filesPublished();
        logs.complete();
        res.status(200).send("Deployed!");
    }
    catch (err) {
        logs.error(err);
        res.status(500).send(JSON.stringify(err));
    }
    finally {
        try {
            // Make sure all local files are cleaned up to free up disk space.
            logs.tempFilesDeleting();
            fs.emptyDirSync(basedir);
            fs.rmdirSync(basedir);
            logs.tempFilesDeleted();
        }
        catch (err) {
            logs.errorDeleting(err);
        }
    }
}));
const getFilePaths = (tree) => {
    return new Promise((resolve) => {
        const walker = tree.walk();
        walker.on("end", (entries) => {
            const paths = entries.map((entry) => entry.path());
            resolve(paths);
        });
        walker.start();
    });
};
const publishFiles = (basedir, paths, token) => __awaiter(this, void 0, void 0, function* () {
    const manifest = buildManifest(basedir, paths);
    logs.deploymentManifest(JSON.stringify(manifest));
    logs.versionLoading();
    const version = yield api("POST", `sites/${config_1.default.siteName}/versions`, token, {
        config: {},
    });
    logs.versionLoaded(version.name);
    logs.requestedFilesLoading();
    const toUpload = yield api("POST", `${version.name}:populateFiles`, token, {
        files: manifest.files,
    });
    logs.requestedFilesLoaded(JSON.stringify(toUpload));
    const { uploadRequiredHashes, uploadUrl } = toUpload;
    for (const hash of uploadRequiredHashes || []) {
        const contentToUpload = manifest.content[hash];
        logs.fileUploading(hash);
        yield uploadFile(`${uploadUrl}/${hash}`, token, contentToUpload);
        logs.fileUploaded(hash);
    }
    logs.uploadFinalizing();
    yield api("PATCH", `${version.name}?update_mask=status`, token, {
        status: "FINALIZED",
    });
    logs.uploadFinalized();
    logs.releasing(version.name);
    yield api("POST", `sites/${config_1.default.siteName}/releases?version_name=${version.name}`, token, { message: "released by Firebase Mods CI" });
    logs.released(version.name);
});
const buildManifest = (basedir, paths) => {
    const rv = { files: {}, content: {} };
    paths.forEach((tmpPath) => {
        if (tmpPath.split("/")[0] != config_1.default.deployRoot ||
            tmpPath.split("/").length < 2) {
            return;
        }
        const path = "/" + tmpPath.split("/", 2)[1];
        const fsPath = `${basedir}/${tmpPath}`;
        const content = fs.readFileSync(fsPath);
        const data = pako_1.gzip(content, { level: 9 });
        const hash = js_sha256_1.sha256(data);
        rv.files[path] = hash;
        rv.content[hash] = data;
    });
    return rv;
};
const uploadFile = (url, token, body) => __awaiter(this, void 0, void 0, function* () {
    const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
    };
    yield node_fetch_1.default(url, {
        method: "POST",
        body,
        headers,
    });
});
const api = (method, path, token, body = null) => __awaiter(this, void 0, void 0, function* () {
    const url = path.indexOf("://") >= 0 ? path : `${constants.API_ROOT}${path}`;
    if (typeof body !== "string") {
        body = JSON.stringify(body);
    }
    const response = yield node_fetch_1.default(url, {
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
            details = yield response.json();
        }
        catch (e) {
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
    return yield response.json();
});
