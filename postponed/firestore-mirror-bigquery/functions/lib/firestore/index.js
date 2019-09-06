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
/*
type FieldProcessor = (fieldValue: any, fields?: FirestoreField[]) => any;
type FieldValidator = (fieldValue: any) => boolean;
*/
/**
 * Map of field processors that convert from a Firestore value into a
 * BigQuery compatible value.
 */
/*
const processors: { [K in FirestoreFieldType]: FieldProcessor } = {
  boolean: (v: boolean) => v,
  geopoint: (v: firebase.firestore.GeoPoint) => ({
    latitude: v.latitude,
    longitude: v.longitude,
  }),
  json: (v) => JSON.stringify(v),
  number: (v: number) => v,
  map: (v, fields: FirestoreField[]) => processData(v, fields),
  reference: (v: firebase.firestore.DocumentReference) => v.path,
  string: (v: string) => v,
  timestamp: (v: firebase.firestore.Timestamp) => v.seconds,
};*/
/**
 * Map of field validators that ensure the data matches the type specified
 * in the schema definition.
 */
/*
const validators: { [K in FirestoreFieldType]: FieldValidator } = {
  boolean: _.isBoolean,
  geopoint: (v) => v instanceof firebase.firestore.GeoPoint,
  json: _.isObject,
  number: _.isNumber,
  map: _.isObject,
  reference: (v) => v instanceof firebase.firestore.DocumentReference,
  string: _.isString,
  timestamp: (v) => v instanceof firebase.firestore.Timestamp,
};*/
/**
 * Extract the DocumentSnapshot data that matches the fields specified in the
 * schema
 */
exports.extractSnapshotData = (snapshot, fields) => {
    return snapshot.data();
};
/**
 * Extract the Object data that matches the fields specifed in the schema.
 */
/*
const processData = (snapshotData: Object, fields: FirestoreField[]) => {
  const data = {};
  fields.forEach((field) => {
    const { name: fieldName } = field;
    const fieldValue = snapshotData[fieldName];

    if (fieldValue === undefined || fieldValue === null) {
      // Ignore the field as there is no data
    } else if (field.repeated && !_.isArray(fieldValue)) {
      // The schema definition stipulates an array, but the value isn't an array
      logs.arrayFieldInvalid(fieldName);
    } else if (
      field.type === "boolean" ||
      field.type === "geopoint" ||
      field.type === "json" ||
      field.type === "map" ||
      field.type === "number" ||
      field.type === "reference" ||
      field.type === "string" ||
      field.type === "timestamp"
    ) {
      data[fieldName] = processField(field, fieldValue);
    } else {
      throw errors.invalidFieldDefinition(field);
    }
  });
  return data;
};
*/
/**
 * Extract the field data, ensure that it conforms to the specified Schema and
 * convert it into a Javascript primitive, Array or Object data type.
 */
/*
const processField = (field: FirestoreField, fieldValue: any): any => {
  const { type } = field;
  const process = processors[type];
  const isValid = validators[type];

  if (field.repeated && _.isArray(fieldValue)) {
    return fieldValue.map((value) => {
      if (isValid(value)) {
        return process(value, field.fields);
      } else {
        logs.dataTypeInvalid(field.name, `${field.type} array`, typeof value);
        return undefined;
      }
    });
  } else if (isValid(fieldValue)) {
    return process(fieldValue, field.fields);
  } else {
    logs.dataTypeInvalid(field.name, field.type, typeof fieldValue);
  }
};
*/
