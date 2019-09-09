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
const firebase = require("firebase-admin");
const inquirer = require("inquirer");
const path = require("path");
const fs_1 = require("fs");
const schema_1 = require("../bigquery/schema");
const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;
const validateInput = (value, name, regex) => {
    if (!value || value === "" || value.trim() === "") {
        return `Please supply a ${name}`;
    }
    if (!value.match(regex)) {
        return `The ${name} must only contain letters or spaces`;
    }
    return true;
};
const questions = [
    {
        message: "What is your Firebase project ID?",
        name: "projectId",
        type: "input",
        validate: (value) => validateInput(value, "project ID", FIRESTORE_VALID_CHARACTERS),
    },
    {
        message: "What is the ID of the BigQuery dataset that you would like to use? (The dataset will be created if it doesn't already exist)",
        name: "datasetId",
        type: "input",
        validate: (value) => validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
    },
    {
        message: "What is the ID of the BigQuery table that you would like to generate a schema view for? (The table must already exist in your specified dataset.)",
        name: "rawTableName",
        type: "input",
        validate: (value) => validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
    },
    {
        message: "Have you installed all your desired schemas in ./schemas/*.json?",
        name: "confirmed",
        type: "confirm",
    }
];
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const { projectId, datasetId, rawTableName, confirmed } = yield inquirer.prompt(questions);
        // Set project ID so it can be used in BigQuery intialization
        process.env.PROJECT_ID = projectId;
        // BigQuery aactually requires this variable to set the project correctly.
        process.env.GOOGLE_CLOUD_PROJECT = projectId;
        // Initialize Firebase
        firebase.initializeApp({
            credential: firebase.credential.applicationDefault(),
            databaseURL: `https://${projectId}.firebaseio.com`,
        });
        // @ts-ignore string not assignable to enum
        const schemaDirectory = [__dirname, "../../schemas"].join('/');
        const schemas = readSchemas(schemaDirectory);
        const viewFactory = new schema_1.FirestoreBigQuerySchemaViewFactory();
        for (const schemaName in schemas) {
            yield viewFactory.initializeSchemaView(datasetId, rawTableName, schemaName, schemas[schemaName]);
        }
        return 0;
    });
}
;
function readSchemas(directory) {
    let results = {};
    let files = fs_1.readdirSync(directory);
    let schemaNames = files.map(fileName => path.basename(fileName).split('.').slice(0, -1).join('.').replace(/-/g, '_'));
    for (var i = 0; i < files.length; i++) {
        const schema = require([directory, files[i]].join('/'));
        results[schemaNames[i]] = schema;
    }
    return results;
}
run()
    .then((result) => {
    console.log("done.");
    process.exit();
})
    .catch((error) => {
    console.error(error.message);
    process.exit();
});
