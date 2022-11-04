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

import * as firebase from "firebase-admin";
import * as inquirer from "inquirer";

const validateInput = (value: any, name: string) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  return true;
};

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "projectId",
    type: "input",
    validate: (value) => validateInput(value, "project ID"),
  },
  {
    default: "./key.json",
    message:
      "What is the path to the service account private key for your Firebase Project?",
    name: "privateKeyPath",
    type: "input",
    validate: (value) =>
      validateInput(value, "path to your service account private key"),
  },
];

const createFirestoreDocument = async (
  path: string,
  value: any = {
    field: "value",
  }
): Promise<void> => {
  await firebase.firestore().doc(path).set(value);
  console.log(`Created Firestore data at path: '${path}'`);
};

const createRTDBDocument = async (
  path: string,
  value: any = { field: "value " }
): Promise<void> => {
  await firebase.database().ref(path).set(value);
  console.log(`Created RTDB data at path: '${path}'`);
};

const createUser = async (uid: string, displayName: string): Promise<void> => {
  await firebase.auth().createUser({ displayName, uid });
  console.log(`Created '${displayName}' with uid: ${uid}`);
};

const uploadFile = async (
  projectId: string,
  filePath: string,
  destinationPath: string
): Promise<void> => {
  const bucketPath = `${projectId}.appspot.com`;
  const bucket = firebase.storage().bucket(bucketPath);
  await bucket.upload(filePath, { destination: destinationPath });
  console.log(`Uploaded file to path: '${bucketPath}/${destinationPath}'`);
};

const populateUserDataDeletionData = async (
  projectId: string
): Promise<void> => {
  // delete-user-data
  console.log("---------------------------------------------------------");
  console.log("Populating data for delete-user-data");
  console.log("---------------------------------------------------------");
  // 1) Create some users
  await createUser("1", "User 1");
  await createUser("2", "User 2");
  // 2) Create some data at Firestore paths: users/{UID},admins/{UID}
  await createFirestoreDocument("admins/1", { name: "User 1" });
  await createFirestoreDocument("users/1", { name: "User 1" });
  await createFirestoreDocument("admins/2", { name: "User 2" });
  await createFirestoreDocument("users/2", { name: "User 2" });
  // 3) Create some data at RTDB paths: users/{UID},admins/{UID}
  await createRTDBDocument("admins/1", { name: "User 1" });
  await createRTDBDocument("users/1", { name: "User 1" });
  await createRTDBDocument("admins/2", { name: "User 2" });
  await createRTDBDocument("users/2", { name: "User 2" });
  // 4) Upload image to: {DEFAULT}/{UID}-pic.png
  await uploadFile(projectId, "./images/pic.png", "1-pic.png");
  await uploadFile(projectId, "./images/pic.png", "2-pic.png");
  console.log();
};

const run = async (): Promise<void> => {
  const { privateKeyPath, projectId } = await inquirer.prompt(questions);

  const serviceAccount = require(privateKeyPath);

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  await populateUserDataDeletionData(projectId);
};

run()
  .then(() => {
    console.log("---------------------------------------------------------");
    console.log("Finished creating extensions test data");
    console.log("---------------------------------------------------------");
    process.exit();
  })
  .catch((error) => {
    console.log("---------------------------------------------------------");
    console.error("Error creating extensions test data:");
    console.error(error);
    console.log("---------------------------------------------------------");
    process.exit();
  });
