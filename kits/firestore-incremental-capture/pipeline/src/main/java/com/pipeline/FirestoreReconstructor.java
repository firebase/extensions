/**
 * Copyright 2023 Google LLC
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

package com.pipeline;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.protobuf.Timestamp;
import com.google.firestore.v1.ArrayValue;
import com.google.firestore.v1.MapValue;
import com.google.firestore.v1.Value;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.time.Instant;

public class FirestoreReconstructor {

    public enum FirestoreType {
        STRING,
        NUMBER,
        BOOLEAN,
        NULL,
        TIMESTAMP,
        GEOPOINT,
        REFERENCE,
    }

    // This method recursively builds a Firestore map from a JSON object
    // representing a Firestore document or map, according to our schema
    public static Map<String, Value> buildFirestoreMap(JsonElement dataJson, String projectId, String databaseId) {

        JsonObject dataObject = dataJson.getAsJsonObject();
        Map<String, Value> fieldsMap = new HashMap<>();

        for (Map.Entry<String, JsonElement> entry : dataObject.entrySet()) {
            JsonElement valueElem = entry.getValue();

            if (valueElem.isJsonObject() && valueElem.getAsJsonObject().has("type")
                    && valueElem.getAsJsonObject().has("value")) {
                JsonObject entryValueObject = valueElem.getAsJsonObject();
                String valueType = entryValueObject.get("type").getAsString().toUpperCase();

                Value val;
                switch (valueType) {
                    case "STRING":
                        val = Value.newBuilder().setStringValue(entryValueObject.get("value").getAsString()).build();
                        break;
                    case "NUMBER":
                        val = Value.newBuilder().setDoubleValue(entryValueObject.get("value").getAsDouble()).build();
                        break;
                    case "BOOLEAN":
                        String originalValue = entryValueObject.get("value").getAsString();

                        if (originalValue.equals("true")) {
                            val = Value.newBuilder().setBooleanValue(true).build();
                        } else {
                            val = Value.newBuilder().setBooleanValue(false).build();
                        }
                        break;
                    case "OBJECT":
                        val = Value.newBuilder().setMapValue(
                                MapValue.newBuilder().putAllFields(
                                        buildFirestoreMap(entryValueObject.get("value"), projectId, databaseId)))
                                .build();
                        break;
                    case "MAP":
                        val = Value.newBuilder().setMapValue(
                                MapValue.newBuilder().putAllFields(
                                        buildFirestoreMap(entryValueObject.get("value"), projectId, databaseId)))
                                .build();
                        break;
                    case "ARRAY":
                        val = Value.newBuilder().setArrayValue(
                                ArrayValue.newBuilder().addAllValues(
                                        buildFirestoreList(entryValueObject.get("value").getAsJsonArray(), projectId,
                                                databaseId)))
                                .build();
                        break;
                    case "GEOPOINT":
                        JsonObject geopointValue = entryValueObject.get("value").getAsJsonObject();
                        JsonObject latitude = geopointValue.get("latitude").getAsJsonObject();
                        JsonObject longitude = geopointValue.get("longitude").getAsJsonObject();

                        Double latitudeValue = latitude.get("value").getAsDouble();
                        Double longitudeValue = longitude.get("value").getAsDouble();

                        val = Value.newBuilder().setGeoPointValue(
                                com.google.type.LatLng.newBuilder().setLatitude(latitudeValue)
                                        .setLongitude(longitudeValue)
                                        .build())
                                .build();
                        break;
                    case "TIMESTAMP":

                        // parse the timestamp value as an Instant
                        Instant instant = Instant.parse(entryValueObject.get("value").getAsString());

                        long epochSecond = instant.getEpochSecond();
                        int nanoSecond = instant.getNano();

                        Timestamp timestamp = Timestamp.newBuilder().setSeconds(epochSecond).setNanos(nanoSecond)
                                .build();

                        // convert to seconds and nanoseconds
                        val = Value.newBuilder().setTimestampValue(timestamp).build();
                        break;

                    case "REFERENCE":

                        String pathString = entryValueObject.get("value").getAsString();

                        String fullReferenceString = String.format(
                                "projects/%s/databases/%s/documents/%s",
                                projectId,
                                databaseId,
                                pathString);

                        val = Value.newBuilder().setReferenceValue(fullReferenceString)
                                .build();
                        break;
                    default:
                        val = null;
                        continue;
                }

                fieldsMap.put(entry.getKey(), val);
            }
        }

        // log it
        return fieldsMap;
    }

    private static List<Value> buildFirestoreList(JsonArray arr, String projectId, String databaseId) {

        List<Value> lst = new ArrayList<>();
        for (JsonElement el : arr) {
            Map<String, Value> mapData = buildFirestoreMap(el, projectId, databaseId);
            Value val = Value.newBuilder().setMapValue(
                    MapValue.newBuilder().putAllFields(mapData)).build();

            lst.add(val);
        }

        return lst;
    }
}
