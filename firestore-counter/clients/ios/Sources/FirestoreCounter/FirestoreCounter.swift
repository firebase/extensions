import FirebaseFirestore
import Firebase

public class FirebaseDistributedCounter {
  private let db: Firestore
  private let shardId = UUID().uuidString
  private var shards = [String: Double]()
  private let collectionId = "_counter_shards_"
  private let shardRef: CollectionReference
  private var docRef: DocumentReference
  private var field: String

  public init(docRef: DocumentReference, field: String) {
    self.docRef = docRef
    self.field = field
    db = Firestore.firestore()
    shardRef = docRef.collection(collectionId)
    shards[self.docRef.path] = 0
    shards[shardRef.document(String(shardId)).path] = 0
    shards[shardRef.document("\t" + String(shardId.prefix(4))).path] = 0
    shards[shardRef.document("\t\t" + String(shardId.prefix(3))).path] = 0
    shards[shardRef.document("\t\t\t" + String(shardId.prefix(2))).path] = 0
    shards[shardRef.document("\t\t\t\t" + String(shardId.prefix(1))).path] = 0
  }

  public func get(result: @escaping (Double?, Error?) -> Void) {
    var documentIds = [String]()

    for key in shards.keys {
      documentIds.append((key as NSString).lastPathComponent)
    }

    shardRef.whereField(FieldPath.documentID(), in: documentIds).getDocuments() { snapshot, error in
      if let error = error {
        print("FirestoreCounter: Error getting documents: \(error)")
        result(nil, error)
      } else {
        if let documents = snapshot?.documents {
          let values = documents.map { (documentSnap) -> Double in
            let document = documentSnap.data()
            if let amount = document[self.field] as? Double {
              return amount
            } else {
              return 0.0
            }
          }

          let sum = values.reduce(0.0) { $0 + $1 }
          result(sum, nil)
        }
      }
    }
  }

  public func increment(by delta: Double) {
    let increment = FieldValue.increment(delta)
    var array = field.components(separatedBy: ".")
    var update = [String: Any]()

    array = array.reversed()

    for component in array {
      if (update.isEmpty) {
        update = [component: increment]
      } else {
        update = [component: update]
      }
    }

    shardRef.document(shardId).setData(update, merge: true)
  }

  public func onSnapshot(_ listener: @escaping (Double?, Error?) -> Void) {
    shards.keys.forEach { path in
      db.document(path).addSnapshotListener { snapshot, error in
        if let error = error {
          print("FirestoreCounter: Error listening to document changes: \(error)")
          listener(nil, error)
        } else {
          guard let snapshot = snapshot,
            let snapshotValue = snapshot.get(self.field),
            let doubleVal = snapshotValue as? Double else {
              listener(nil, error)
              return
          }
          self.shards[path] = doubleVal
          let sum = self.shards.reduce(0.0) { $0 + $1.value }
          listener(sum, nil)
        }
      }
    }
  }
}
