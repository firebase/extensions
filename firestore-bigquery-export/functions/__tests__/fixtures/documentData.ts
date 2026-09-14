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

import * as admin from "firebase-admin";

export const documentData = async () => {
  const firstReference = admin.firestore().doc("reference/reference1");
  firstReference.set({
    a_string: "a_string_value",
    an_integr: 25,
    a_boolean: false,
    a_list: ["a_string_value", "b_string_value", "c_string_value"],
    a_date: new Date(2023, 7, 19, 7, 12, 38),
  });

  const secondReference = admin.firestore().doc("reference/reference2");
  secondReference.set({
    a_string: "a_string_value",
    an_integr: 30,
    a_boolean: true,
    a_list: ["a_string_value", "b_string_value", "c_string_value"],
    a_date: new Date(2023, 7, 19, 7, 12, 38),
  });

  return {
    // String
    a_string: "a_string_value",

    // Number
    an_integer: 30,

    // Boolean
    a_boolean: true,

    // Array
    a_list: ["a_string_value", "b_string_value", "c_string_value"],

    // Object
    an_object_list: {
      street: "a_street_string_value",
      city: "a_city_string_value",
      state: "a_state_string_value",
      zip: "a_zip_string_value",
    },

    // Timestamp
    a_date: new Date(2023, 7, 19, 7, 12, 38),

    // GeoPoint
    a_geo_object: {
      latitude: 36.7783,
      longitude: -119.4179,
    },

    // Reference
    singleReference: firstReference,

    // Array of References
    reference_list: [firstReference, secondReference],
  };
};
