"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changedFieldMode = (fieldName, bqMode, schemaMode) => new Error(`Field ${fieldName} has different field mode. BigQuery mode: ${bqMode}; Schema mode: ${schemaMode}`);
exports.changedFieldType = (fieldName, bqType, schemaType) => new Error(`Field: ${fieldName} has changed field type. BigQuery type: ${bqType}; Schema type: ${schemaType}`);
exports.invalidFieldDefinition = (field) => new Error(`Invalid field definition: ${JSON.stringify(field)}`);
