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
import org.apache.beam.sdk.transforms.PTransform;
import org.apache.beam.sdk.values.PCollection;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.firestore.v1.RunQueryRequest;
import com.google.firestore.v1.RunQueryResponse;

public class ReadFromFirestoreWithTimestamp
    extends PTransform<PCollection<RunQueryRequest>, PCollection<RunQueryResponse>> {
  private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

  final private Instant readTime;

  public ReadFromFirestoreWithTimestamp(Instant readTime) {
    this.readTime = readTime;
  }

  @Override
  public PCollection<RunQueryResponse> expand(PCollection<RunQueryRequest> input) {
    try {
      Utils.adjustDate(readTime);
    } catch (Exception e) {
      LOG.error(e.getMessage());
      throw new IllegalArgumentException(e);
    }

    LOG.info("Read time: " + readTime.toDateTime().toString());

    return input.apply(
        "Batch read from Firestore with Timestamp",
        FirestoreIO.v1().read().runQuery().withReadTime(readTime).build());
  }
}
