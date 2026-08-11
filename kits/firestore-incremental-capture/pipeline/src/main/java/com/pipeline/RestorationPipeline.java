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

import org.apache.beam.runners.dataflow.options.DataflowPipelineOptions;
import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.PipelineResult;
import org.apache.beam.sdk.io.gcp.firestore.FirestoreIO;
import org.apache.beam.sdk.options.Description;
import org.apache.beam.sdk.options.PipelineOptionsFactory;
import org.apache.beam.sdk.transforms.Create;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.PCollection;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.cloud.firestore.FirestoreOptions;
import com.google.firestore.v1.Document;
import com.google.firestore.v1.Write;

public class RestorationPipeline {
  private static final FirestoreOptions DEFAULT_FIRESTORE_OPTIONS = FirestoreOptions.getDefaultInstance();
  private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

  public interface MyOptions extends DataflowPipelineOptions,
      org.apache.beam.sdk.io.gcp.firestore.FirestoreOptions {

    @Description("The timestamp to read from Firestore")
    Long getTimestamp();

    void setTimestamp(Long value);

    @Description("The Firestore collection to read from, or '*' to read from all collections")
    String getFirestoreCollectionId();

    void setFirestoreCollectionId(String value);

    @Description("The BigQuery dataset Id to export the data from")
    String getBigQueryDataset();

    void setBigQueryDataset(String value);

    @Description("The BigQuery table Id to export the data from")
    String getBigQueryTable();

    void setBigQueryTable(String value);

  }

  public static void main(String[] args) {

    MyOptions options = PipelineOptionsFactory.fromArgs(args).withValidation().as(MyOptions.class);

    Pipeline pipeline = Pipeline.create(options);

    String project = options.getProject();
    String collectionId = options.getFirestoreCollectionId();
    String secondaryDatabase = options.getFirestoreDb();
    String datasetId = options.getBigQueryDataset();
    String tableId = options.getBigQueryTable();
    String defaultDatabase = DEFAULT_FIRESTORE_OPTIONS.getDatabaseId();
    Instant readTime = Utils.adjustDate(Instant.ofEpochSecond(options.getTimestamp()));

    options.setFirestoreDb(secondaryDatabase);

    // Read from Firestore at the specified timestamp to form the baseline
    // The returned PCollection contains the documents at the specified timestamp in
    // Firestore
    PCollection<Document> documentsAtReadTime = pipeline
        .apply("Passing the collection ID " + collectionId, Create.of(collectionId))
        .apply("Prepare the PITR query", new FirestoreHelpers.RunQuery(project, defaultDatabase))
        .apply(
            FirestoreIO.v1()
                .read()
                .runQuery()
                .withReadTime(readTime)
                .build())
        .apply(new FirestoreHelpers.RunQueryResponseToDocument());

    // Write the documents to the secondary database
    documentsAtReadTime
        .apply("Create the write request",
            ParDo.of(new DoFn<Document, Write>() {
              @ProcessElement
              public void processElement(ProcessContext c) {
                Document document = c.element();

                // Replace the default database with the secondary database in the document id
                String id = document.getName().replace(defaultDatabase, secondaryDatabase);

                Document newDocument = Document.newBuilder()
                    .setName(id)
                    .putAllFields(document.getFieldsMap())
                    .build();

                c.output(Write.newBuilder()
                    .setUpdate(newDocument)
                    .build());
              }
            }))
        .apply("Write to the Firestore database instance", FirestoreIO.v1().write().batchWrite().build());

    // BigQuery read and subsequent Firestore write
    pipeline
        .apply(Create.of(""))
        .apply("Read from BigQuery",
            new IncrementalCaptureLog(project, readTime, secondaryDatabase, datasetId, tableId))
        .apply("Prepare write operations",
            new FirestoreHelpers.DocumentToWrite(defaultDatabase, defaultDatabase))
        .apply("Write to the Firestore database instance (From BigQuery)",
            FirestoreIO.v1().write().batchWrite().build());

    PipelineResult result = pipeline.run();

    // We try to identify if the pipeline is being run or a template is being
    // created
    if (options.as(DataflowPipelineOptions.class).getTemplateLocation() == null) {
      // If template location is null, then, pipeline is being run, so we can wait
      // until finish
      result.waitUntilFinish();
    }
  }
}
