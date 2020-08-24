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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    bucket: process.env.IMG_BUCKET,
    cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
    imageSizes: process.env.IMG_SIZES.split(","),
    resizedImagesPath: process.env.RESIZED_IMAGES_PATH,
    deleteOriginalFile: process.env.DELETE_ORIGINAL_FILE === "true",
};
