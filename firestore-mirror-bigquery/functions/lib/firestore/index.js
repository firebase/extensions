"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase = require("firebase-admin");
const _ = require("lodash");
/**
 * Map of field processors that convert from a Firestore value into a
 * BigQuery compatible value.
 */
const processors = {
    boolean: (v) => v,
    geopoint: (v) => ({
        latitude: v.latitude,
        longitude: v.longitude,
    }),
    number: (v) => v,
    map: (v, fields) => processData(v, fields),
    reference: (v) => v.path,
    string: (v) => v,
    timestamp: (v) => v.seconds,
};
/**
 * Map of field validators that ensure the data matches the type specified
 * in the schema definition.
 */
const validators = {
    boolean: _.isBoolean,
    geopoint: (v) => v instanceof firebase.firestore.GeoPoint,
    number: _.isNumber,
    map: _.isObject,
    reference: (v) => v instanceof firebase.firestore.DocumentReference,
    string: _.isString,
    timestamp: (v) => v instanceof firebase.firestore.Timestamp,
};
/**
 * Extract the DocumentSnapshot data that matches the fields specified in the
 * schema
 */
exports.extractSnapshotData = (snapshot, fields) => {
    return processData(snapshot.data(), fields);
};
/**
 * Extract the Object data that matches the fields specifed in the schema.
 */
const processData = (snapshotData, fields) => {
    const data = {};
    fields.forEach((field) => {
        const { name: fieldName } = field;
        const fieldValue = snapshotData[fieldName];
        if (fieldValue === undefined || fieldValue === null) {
            // Ignore the field as there is no data
        }
        else if (field.repeated && !_.isArray(fieldValue)) {
            // The schema definition stipulates an array, but the value isn't an array
            console.warn(`Array field '${fieldName}' does not contain an array, skipping`);
        }
        else if (field.type === "boolean" ||
            field.type === "geopoint" ||
            field.type === "map" ||
            field.type === "number" ||
            field.type === "reference" ||
            field.type === "string" ||
            field.type === "timestamp") {
            data[fieldName] = processField(field, fieldValue);
        }
        else {
            throw new Error(`Invalid field definition: ${JSON.stringify(field)}`);
        }
    });
    return data;
};
/**
 * Extract the field data, ensure that it conforms to the specified Schema and
 * convert it into a Javascript primitive, Array or Object data type.
 */
const processField = (field, fieldValue) => {
    const { type } = field;
    const process = processors[type];
    const isValid = validators[type];
    if (field.repeated && _.isArray(fieldValue)) {
        return fieldValue.map((value) => {
            if (isValid(value)) {
                return process(value, field.fields);
            }
            else {
                console.warn(`${field.type} array field '${field.name}': Invalid data type: ${typeof value}`);
                return undefined;
            }
        });
    }
    else if (isValid(fieldValue)) {
        return process(fieldValue, field.fields);
    }
    else {
        console.warn(`${field.type} field '${field.name}': Invalid data type: ${typeof fieldValue}`);
    }
};
