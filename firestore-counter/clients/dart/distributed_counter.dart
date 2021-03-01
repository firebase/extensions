import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

const SHARD_COLLECTION_ID = '_counter_shards_';

class DistributedCounter {
  static String shardId;

  final DocumentReference doc;
  final String field;
  final FirebaseFirestore db;

  Map<String, int> shards = {};
  List<StreamSubscription<DocumentSnapshot>> subscriptions = [];

  static void init(String shardId) {
    DistributedCounter.shardId = shardId;
  }

  /// Constructs a sharded counter object that references to a field
  /// in a document that is a counter.
  ///
  /// @param doc A reference to a document with a counter field.
  /// @param field A path to a counter field in the above document.
  DistributedCounter(this.doc, this.field) : db = doc.firestore {
    final shardsRef = doc.collection(SHARD_COLLECTION_ID);
    shards[doc.path] = 0;
    shards[shardsRef.doc(shardId).path] = 0;
    shards[shardsRef.doc('\t' + shardId.substring(0, 4)).path] = 0;
    shards[shardsRef.doc('\t\t' + shardId.substring(0, 3)).path] = 0;
    shards[shardsRef.doc('\t\t\t' + shardId.substring(0, 2)).path] = 0;
    shards[shardsRef.doc('\t\t\t\t' + shardId.substring(0, 1)).path] = 0;
  }

  /// Get latency compensated view of the counter.
  ///
  /// All local increments will be reflected in the counter even if the main
  /// counter hasn't been updated yet.
  Future<int> get(GetOptions options) async {
    final valuePromises = shards.keys.map((path) async {
      final shard = await db.doc(path).get(options);
      return shard.get(field) ?? 0;
    });
    final values = await Future.wait(valuePromises);
    return values.reduce((a, b) => a + b);
  }

  /// Listen to latency compensated view of the counter.
  ///
  /// All local increments to this counter will be immediately visible in the
  /// snapshot.
  void onSnapshot(void Function(int) observable) {
    subscriptions.addAll(
        shards.keys.map((path) => db.doc(path).snapshots().listen((snap) {
              shards[snap.reference.path] = snap.exists ? snap.get(field) : 0;
              final sum = shards.values.reduce((a, b) => a + b);
              observable(sum);
            })));
  }

  /// Increment the counter by a given value.
  ///
  /// e.g.
  /// const counter = new sharded.Counter(db.doc('path/document'), 'counter');
  /// counter.incrementBy(1);
  Future<void> incrementBy(int val) {
    final increment = FieldValue.increment(val);
    final update = this
        .field
        .split('.')
        .reversed
        .fold(increment, (value, name) => {name: value});
    return shard().set(update, SetOptions(merge: true));
  }

  /// Access the assigned shard directly. Useful to update multiple counters
  /// at the same time, batches or transactions.
  ///
  /// e.g.
  /// const counter = new sharded.Counter(db.doc('path/counter'), '');
  /// const shardRef = counter.shard();
  /// shardRef.set({'counter1', firestore.FieldValue.Increment(1),
  ///               'counter2', firestore.FieldValue.Increment(1));
  DocumentReference shard() {
    return doc.collection(SHARD_COLLECTION_ID).doc(shardId);
  }

  void unsubscribe() {
    subscriptions.forEach((element) {
      element.cancel();
    });
    subscriptions = [];
  }
}
