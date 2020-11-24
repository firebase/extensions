import FirebaseFirestore
import Firebase

public class FirestoreShardCounter {
  private let firestore: Firestore
  private let shardId = UUID().uuidString
  private var shards = [String: Double]()
  private let collectionId = "_counter_shards_"
  private let shardRef: CollectionReference
  private var docRef: DocumentReference
  private var field: String

  public init(docRef: DocumentReference, field: String) {
    self.docRef = docRef
    self.field = field
    self.firestore = docRef.firestore
    self.shardRef = docRef.collection(collectionId)
    shards[self.docRef.path] = Double(0)
    shards[self.shardRef.document(String(self.shardId)).path] = Double(0)
    shards[self.shardRef.document("\t" + String(self.shardId.prefix(4))).path] = Double(0)
    shards[self.shardRef.document("\t\t" + String(self.shardId.prefix(3))).path] = Double(0)
    shards[self.shardRef.document("\t\t\t" + String(self.shardId.prefix(2))).path] = Double(0)
    shards[self.shardRef.document("\t\t\t\t" + String(self.shardId.prefix(1))).path] = Double(0)
  }

  public func get(result: @escaping (Double?, Error?) -> ()) {
    var documentIds = [String]()
    var totalValue = Double(0)

    for key in shards.keys {
      documentIds.append((key as NSString).lastPathComponent)
    }

    shardRef.whereField(FieldPath.documentID(), in: documentIds).getDocuments() { (snapshot, error) in
      if let error = error {
        print("FirestoreCounter: Error getting documents: \(error)")
        result(nil, error)
      } else {
        for queryDoc in snapshot!.documents {
          let document = queryDoc.data()
          let value = document[self.field] == nil ? 0 : document[self.field] as! Double;
          totalValue += value
        }

        result(totalValue, nil)
      }
    }
  }

  public func incrementBy(val: Double) {
    let increment = FieldValue.increment(val)
    var array = field.components(separatedBy: ".")
    var update = [String: Any]()
    array.reverse()

    for component in array {
      if (update.isEmpty) {
        update = [component: increment]
      } else {
        update = [component: update]
      }
    }

    return shardRef.document(shardId).setData(update, merge: true)
  }

  public func onSnapshot(observer: @escaping (Double?, Error?) -> ()) {
    for path in shards.keys {
      firestore.document(path).addSnapshotListener { (snapshot, error) in

        if let error = error {
          print("FirestoreCounter: Error listening to document changes: \(error)")

          observer(nil, error)
        } else {
          if let snapshotValue = snapshot?.get(self.field) {
            let doubleVal = snapshotValue as! Double
            var sum = Double(0)
            self.shards[path] = doubleVal

            for value in self.shards.values {
              sum += value
            }

            observer(sum, nil)
          }
        }
      }
    }
  }
}
