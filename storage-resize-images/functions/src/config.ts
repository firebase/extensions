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

export enum deleteImage {
  always = 0,
  never,
  onSuccess,
}

function deleteOriginalFile(deleteType) {
  switch (deleteType) {
    case "true":
      return deleteImage.always;
    case "false":
      return deleteImage.never;
    default:
      return deleteImage.onSuccess;
  }
}

function paramToArray(param) {
  return typeof param === "string" ? param.split(",") : undefined;
}

function associateSizes(paths, sizes) {
  if (!paths) return paths;
  return paths.map((path) => {
    if (path.endsWith("}")) {
      // user has specified a set of sizes for this path
      const splits = path.split("{");
      const realPath = splits[0];
      // read indexes of the sizes
      const sizeRefs = splits[1]
        .replace("}", "")
        .split(" ")
        .filter(
          (it) =>
            it &&
            it.length > 0 &&
            isNaN(parseInt(it)) === false &&
            // reference to sizes should be 1 based, not 0 based
            parseInt(it) > 0 &&
            parseInt(it) <= sizes.length
        )
        .map((it) => parseInt(it))
        // turn "human" references to valid sizes indexes
        .map((it) => it - 1);

      // pick the requested sizes
      const pathSizes = sizes.filter(
        (size, index) => sizeRefs.indexOf(index) > -1
      );

      return {
        path: realPath,
        sizes: pathSizes,
      };
    }

    // defaults to all sizes
    return {
      path,
      sizes,
    };
  });
}

export default {
  bucket: process.env.IMG_BUCKET,
  cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
  imageSizes: process.env.IMG_SIZES.split(","),
  resizedImagesPath: process.env.RESIZED_IMAGES_PATH,
  includePathList: associateSizes(
    paramToArray(process.env.INCLUDE_PATH_LIST),
    process.env.IMG_SIZES.split(",")
  ),
  excludePathList: paramToArray(process.env.EXCLUDE_PATH_LIST),
  deleteOriginalFile: deleteOriginalFile(process.env.DELETE_ORIGINAL_FILE),
  imageType: process.env.IMAGE_TYPE,
};
