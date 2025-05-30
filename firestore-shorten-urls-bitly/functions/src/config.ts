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

export default {
  bitlyAccessToken: process.env.BITLY_ACCESS_TOKEN,
  collectionPath: process.env.COLLECTION_PATH,
  location: process.env.LOCATION,
  shortUrlFieldName: process.env.SHORT_URL_FIELD_NAME,
  urlFieldName: process.env.URL_FIELD_NAME,
  database: process.env.DATABASE,
  databaseRegion: process.env.DATABASE_REGION,
};
