/**
 * Copyright 2026 Google LLC
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

import mockedEnv from "mocked-env";

const environment = {
  LOCATION: "us-central1",
  IMG_BUCKET: "extensions-testing.appspot.com",
  CACHE_CONTROL_HEADER: undefined,
  IMG_SIZES: `200x200`,
  RESIZED_IMAGES_PATH: undefined,
  DELETE_ORIGINAL_FILE: "true",
  CONTENT_FILTER_LEVEL: "OFF",
};

let restoreEnv;

let deleteTypeCounter = 0;

let config;
let deleteImage;

describe("extension", () => {
  beforeEach(() => {
    jest.resetModules();
    if (deleteTypeCounter === 0) {
      restoreEnv = mockedEnv(environment);
    } else if (deleteTypeCounter === 1) {
      restoreEnv = mockedEnv({ ...environment, DELETE_ORIGINAL_FILE: "false" });
    } else if (deleteTypeCounter === 2) {
      restoreEnv = mockedEnv({
        ...environment,
        DELETE_ORIGINAL_FILE: "on_success",
      });
    }
    const actualConfigModule = jest.requireActual("../src/config");
    config = actualConfigModule.config;
    deleteImage = actualConfigModule.deleteImage;
  });

  afterEach(() => restoreEnv());

  test("configuration detected from environment variables", async () => {
    expect(config).toMatchSnapshot({});
  });

  test("always delete original file", async () => {
    deleteTypeCounter++;
    expect(config.deleteOriginalFile).toEqual(deleteImage.always);
  });

  test("never delete original file", async () => {
    deleteTypeCounter++;
    expect(config.deleteOriginalFile).toEqual(deleteImage.never);
  });
  test("delete original file on success", async () => {
    expect(config.deleteOriginalFile).toEqual(deleteImage.onSuccess);
  });
});
