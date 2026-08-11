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

import java.util.Map;

import org.apache.avro.generic.GenericRecord;
import org.apache.beam.sdk.io.gcp.bigquery.BigQueryIO;
import org.apache.beam.sdk.io.gcp.bigquery.SchemaAndRecord;
import org.apache.beam.sdk.transforms.PTransform;
import org.apache.beam.sdk.transforms.SerializableFunction;
import org.apache.beam.sdk.values.KV;
import org.apache.beam.sdk.values.PCollection;
import org.joda.time.DateTime;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.firestore.v1.Document;
import com.google.firestore.v1.Value;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

public class IncrementalCaptureLog
    extends PTransform<PCollection<String>, PCollection<KV<String, Document>>> {
  private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

  final private String projectId;
  final private String firestoreDbId;
  final private Instant timestamp;
  final private String datasetId;
  final private String tableId;

  public IncrementalCaptureLog(String projectId, Instant timestamp, String firestoreDbId, String datasetId,
      String tableId) {
    this.projectId = projectId;
    this.timestamp = timestamp;
    this.firestoreDbId = firestoreDbId;
    this.datasetId = datasetId;
    this.tableId = tableId;
  }

  @Override
  public PCollection<KV<String, Document>> expand(PCollection<String> input) {

    String formattedTimestamp = new DateTime(Utils.adjustDate(timestamp)).toString("yyyy-MM-dd HH:mm:ss");

    return input.getPipeline().apply("Read from BigQuery with Dynamic Query",
        BigQueryIO.read(new SerializableFunction<SchemaAndRecord, KV<String, Document>>() {
          public KV<String, Document> apply(SchemaAndRecord schemaAndRecord) {
            return convertToFirestoreValue(schemaAndRecord, projectId, firestoreDbId);
          }
        }).fromQuery(constructQuery(formattedTimestamp)).usingStandardSql().withTemplateCompatibility());
  }

  private String constructQuery(String timestamp) {

    LOG.info("Querying BigQuery for changes before timestamp: " + timestamp);
    String query = "WITH RankedChanges AS (" +
        "    SELECT " +
        "        documentId," +
        "        documentPath," +
        "        changeType," +
        "        beforeData," +
        "        afterData," +
        "        timestamp," +
        "        ROW_NUMBER() OVER(PARTITION BY documentId ORDER BY timestamp DESC) as rank" +
        "    FROM `" + projectId + "." + datasetId + "." + tableId + "`" +
        "    WHERE timestamp < TIMESTAMP('" + (timestamp) + "') " +
        ") " +
        "SELECT " +
        "    documentId," +
        "    documentPath," +
        "    changeType," +
        "    beforeData," +
        "    afterData," +
        "    timestamp " +
        "FROM RankedChanges " +
        "WHERE rank = 1 " +
        "ORDER BY documentId, timestamp DESC";

    return query;

  }

  private static KV<String, Document> convertToFirestoreValue(SchemaAndRecord schemaAndRecord, String projectId,
      String databaseId) {

    GenericRecord record = schemaAndRecord.getRecord();

    String data = record.get("afterData").toString();
    String documentPath = createDocumentName(record.get("documentPath").toString(), projectId, databaseId);
    String changeType = record.get("changeType").toString();

    // this JsonElement has serialized data, e.g a string would be represented on
    // the json tree as {type: "STRING", value: "some string"}
    JsonElement dataJson = JsonParser.parseString(data);

    Map<String, Value> firestoreMap = FirestoreReconstructor.buildFirestoreMap(dataJson, projectId, databaseId);

    // using static methods as beam seems to error when passing an instance version
    // of FirestoreReconstructor to the transform
    Document doc = Document.newBuilder().putAllFields((Map<String, Value>) firestoreMap).setName(createDocumentName(
        documentPath, projectId, databaseId)).build();

    KV<String, Document> kv = KV.of(changeType, doc);

    return kv;
  }

  private static String createDocumentName(String path, String projectId, String databaseId) {
    String documentPath = String.format(
        "projects/%s/databases/%s/documents",
        projectId,
        databaseId);

    return documentPath + "/" + path;
  }

}
