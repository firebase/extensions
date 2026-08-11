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

import org.apache.beam.sdk.io.gcp.firestore.FirestoreIO;
import org.apache.beam.sdk.io.gcp.firestore.FirestoreV1.BatchWriteWithSummary;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.transforms.PTransform;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.KV;
import org.apache.beam.sdk.values.PCollection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.firestore.v1.Document;
import com.google.firestore.v1.RunQueryRequest;
import com.google.firestore.v1.RunQueryResponse;
import com.google.firestore.v1.StructuredQuery;
import com.google.firestore.v1.StructuredQuery.CollectionSelector;
import com.google.firestore.v1.Write;

public class FirestoreHelpers {
  public static final class RunQuery extends BasePTransform<String, RunQueryRequest> {
    private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

    final String projectId;

    public RunQuery(String projectId, String database) {
      super("projects/" + projectId + "/databases/" + database + "/documents");
      this.projectId = projectId;
    }

    @Override
    public PCollection<RunQueryRequest> expand(PCollection<String> input) {
      LOG.info(baseDocumentPath);
      return input.apply(
          ParDo.of(
              new DoFn<String, RunQueryRequest>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                  final String collectionId = c.element();

                  if (collectionId.equals("*")) {
                    LOG.info("Querying all collections");
                    RunQueryRequest runQueryRequest = RunQueryRequest.newBuilder()
                        .setParent(baseDocumentPath)
                        .setStructuredQuery(StructuredQuery.newBuilder().build())
                        .build();

                    c.output(runQueryRequest);
                    return;
                  }

                  CollectionSelector collection = CollectionSelector
                      .newBuilder()
                      .setCollectionId(collectionId)
                      .build();

                  RunQueryRequest runQueryRequest = RunQueryRequest.newBuilder()
                      .setParent(baseDocumentPath)
                      .setStructuredQuery(
                          com.google.firestore.v1.StructuredQuery.newBuilder()
                              .addFrom(collection)
                              .build())
                      .build();

                  c.output(runQueryRequest);
                }
              }));
    }
  }

  public static final class RunQueryResponseToDocument extends BasePTransform<RunQueryResponse, Document> {

    public RunQueryResponseToDocument() {
      super("");
    }

    @Override
    public PCollection<Document> expand(PCollection<RunQueryResponse> input) {
      return input.apply(
          ParDo.of(
              new DoFn<RunQueryResponse, Document>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                  RunQueryResponse response = c.element();
                  c.output(response.getDocument());
                }
              }));
    }
  }

  public static final class DocumentToWrite extends BasePTransform<KV<String, Document>, Write> {

    final String projectId;

    public DocumentToWrite(String projectId, String database) {
      super("projects/" + projectId + "/databases/" + database + "/documents");
      this.projectId = projectId;
    }

    @Override
    public PCollection<Write> expand(PCollection<KV<String, Document>> input) {
      return input.apply(
          ParDo.of(
              new DoFn<KV<String, Document>, Write>() {
                @ProcessElement
                public void processElement(ProcessContext c) {
                  String changeType = c.element().getKey();
                  Document document = c.element().getValue();

                  // LOG.info("STEP ONE >>>>>>> changeType: {}, documentName: {}", changeType,
                  // document.getName());

                  switch (changeType) {
                    case "DELETE":
                      c.output(Write.newBuilder()
                          .setDelete(document.getName())
                          .build());

                      break;

                    default:
                      c.output(Write.newBuilder()
                          .setUpdate(document)
                          .build());
                  }
                }
              }));
    }
  }

  private abstract static class BasePTransform<InT, OutT>
      extends PTransform<PCollection<InT>, PCollection<OutT>> {

    protected final String baseDocumentPath;

    private BasePTransform(String baseDocumentPath) {
      this.baseDocumentPath = baseDocumentPath;
    }
  }
}
