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

const configuration = () => ({
  location: process.env.LOCATION,
});

export const deletePath = (userId: string, path: string) => {
  console.log(`User: ${userId} has requested to delete path: '${path}'`);
};

export const error = (path: string, e: Error) => {
  console.error(`Error when trying to delete: '${path}'`, e);
};

export const init = () => {
  console.log("Initialising mod with configuration", configuration());
};

export const pathMissing = () => {
  console.warn("Unable to delete, no 'path' is specified");
};

export const start = () => {
  console.log("Started mod execution with configuration", configuration());
};

export const success = (path: string) => {
  console.log(`Path: '${path}' was successfully deleted`);
};

export const userMissingClaim = () => {
  console.warn(
    "Unable to delete, the user does not have the 'fsdelete' custom claim"
  );
};

export const userUnauthenticated = () => {
  console.warn("Unable to delete, the user is unauthenticated");
};
