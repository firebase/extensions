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

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import com.google.firestore.v1.Document;

public class WriteToFirestoreDoFn extends DoFn<Document, BatchWriteWithSummary> {
    private final String projectId;
    private final String databaseId;
    private transient Firestore firestore;

    public WriteToFirestoreDoFn(String projectId, String databaseId) {
        this.projectId = projectId;
        this.databaseId = databaseId;
    }

    @Setup
    public void setup() {
        // Initialize the Firestore client with the specified projectId
        firestore = FirestoreOptions.newBuilder()
                .setProjectId(projectId)
                .setDatabaseId(databaseId)
                .build()
                .getService();
    }

    @ProcessElement
    public void processElement(ProcessContext c) {
        // Write the document data to Firestore
        c.output(FirestoreIO.v1().write().batchWrite().build());
    }

    @Teardown
    public void teardown() {
        if (firestore != null) {
            try {
                firestore.close();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
