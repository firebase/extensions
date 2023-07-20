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
