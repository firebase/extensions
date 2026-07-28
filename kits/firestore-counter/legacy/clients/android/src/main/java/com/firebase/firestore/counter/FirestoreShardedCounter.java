/**
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
package com.firebase.firestore.counter;

import androidx.annotation.Nullable;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

public class FirestoreShardedCounter {
  private static final String SHARD_COLLECTION_ID = "_counter_shards_";

  private final DocumentReference doc;
  private final String field;
  private final FirebaseFirestore firestore;
  private final String shardId;
  private final Map<String, Double> shards = new HashMap<>();

  public FirestoreShardedCounter(DocumentReference doc, String field) {
    this.doc = doc;
    this.field = field;
    this.firestore = doc.getFirestore();
    this.shardId = UUID.randomUUID().toString();

    CollectionReference shardsRef = doc.collection(SHARD_COLLECTION_ID);
    this.shards.put(doc.getPath(), 0D);
    this.shards.put(shardsRef.document(this.shardId).getPath(), 0D);
    this.shards.put(shardsRef.document("\t" + this.shardId.substring(0, 4)).getPath(), 0D);
    this.shards.put(shardsRef.document("\t\t" + this.shardId.substring(0, 3)).getPath(), 0D);
    this.shards.put(shardsRef.document("\t\t\t" + this.shardId.substring(0, 2)).getPath(), 0D);
    this.shards.put(shardsRef.document("\t\t\t\t" + this.shardId.substring(0, 1)).getPath(), 0D);
  }

  public double get() throws InterruptedException {
    final List<Double> shardValues = new ArrayList<>();
    final CountDownLatch latch = new CountDownLatch(shards.size());

    for (String path : shards.keySet()) {
      firestore
          .document(path)
          .get()
          .addOnSuccessListener(
              new OnSuccessListener<DocumentSnapshot>() {
                @Override
                public void onSuccess(DocumentSnapshot documentSnapshot) {
                  Double snapshotValue = (Double) documentSnapshot.get(field);
                  shardValues.add(snapshotValue == null ? 0 : snapshotValue);
                  latch.countDown();
                }
              });
    }

    latch.await();

    double sum = 0;
    for (Double shardValue : shardValues) {
      sum += shardValue;
    }
    return sum;
  }

  public Task<Void> incrementBy(double value) {
    FieldValue increment = FieldValue.increment(value);
    String[] parts = field.split("\\.");

    Map<String, Object> update = null;
    for (int i = parts.length - 1; i >= 0; i--) {
      String part = parts[i];
      Map<String, Object> innerUpdate = new HashMap<>();
      if (update == null) {
        innerUpdate.put(part, increment);
      } else {
        innerUpdate.put(part, update);
      }
      update = innerUpdate;
    }

    return shard().set(update, SetOptions.merge());
  }

  public ListenerRegistration onSnapshot(final EventListener<Double> snapshotListener) {
    final List<ListenerRegistration> registrations = new ArrayList<>();

    for (final String path : shards.keySet()) {
      ListenerRegistration registration =
          firestore
              .document(path)
              .addSnapshotListener(
                  new EventListener<DocumentSnapshot>() {
                    @Override
                    public void onEvent(
                        @Nullable DocumentSnapshot documentSnapshot,
                        @Nullable FirebaseFirestoreException e) {
                      if (e != null) {
                        snapshotListener.onEvent(null, e);
                      } else {
                        Double snapshotValue = (Double) documentSnapshot.get(field);
                        shards.put(path, snapshotValue == null ? 0 : snapshotValue);

                        double sum = 0;
                        for (Double shardValue : shards.values()) {
                          sum += shardValue;
                        }
                        snapshotListener.onEvent(sum, null);
                      }
                    }
                  });

      registrations.add(registration);
    }

    return new ListenerRegistration() {
      @Override
      public void remove() {
        for (ListenerRegistration registration : registrations) {
          registration.remove();
        }
      }
    };
  }

  public DocumentReference shard() {
    return doc.collection(SHARD_COLLECTION_ID).document(shardId);
  }
}
