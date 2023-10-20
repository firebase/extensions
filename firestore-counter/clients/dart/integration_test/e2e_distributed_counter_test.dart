import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firestore_counter/distributed_counter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late final FirebaseFirestore firestore;
  late final DocumentReference document;

  setUpAll(() async {
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: '123',
        appId: '123',
        messagingSenderId: '123',
        projectId: 'demo',
      ),
    );
    firestore = FirebaseFirestore.instance;
    firestore.useFirestoreEmulator('localhost', 8080);
    document = firestore.doc('pages/hello-world');
    document.set({'visits': 0});
  });

  test('Count is initially 0', () async {
    final distCounter = DistributedCounter(document, 'visits');

    expectLater(await distCounter.get(), equals(0));
  });

  test('Increment by 1', () async {
    final distCounter = DistributedCounter(document, 'visits');
    distCounter.incrementBy(1);
    expectLater(await distCounter.get(), equals(2));
  });
}
