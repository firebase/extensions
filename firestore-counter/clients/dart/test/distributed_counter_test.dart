import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firestore_counter/distributed_counter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

@GenerateNiceMocks([
  MockSpec<FirebaseFirestore>(),
  MockSpec<DocumentReference>(),
  MockSpec<CollectionReference>(),
])
import 'distributed_counter_test.mocks.dart';

void main() {
  late final DocumentReference<Map<String, dynamic>> document;
  final field = 'reports';

  setUpAll(() {
    final firestore = MockFirebaseFirestore();
    when(firestore.doc('foo')).thenReturn(MockDocumentReference());
    document = firestore.doc('foo');
  });

  test('ShardId is different for each new instance', () {
    when(document.collection(SHARD_COLLECTION_ID))
        .thenReturn(MockCollectionReference());
    final col = document.collection(SHARD_COLLECTION_ID);
    when(col.doc(any)).thenReturn(MockDocumentReference());

    final distributedCounter_1 = DistributedCounter(document, field);
    final distributedCounter_2 = DistributedCounter(document, field);

    expect(distributedCounter_1.shardId, isNot(distributedCounter_2.shardId));
  });
}
