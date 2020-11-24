### Installation

1. Ensure your Swift app already has Firebase [initialized](https://firebase.google.com/docs/ios/setup). 
2. Add the `firestore-counter/clients/ios` directory to your project in Xcode.
3. In the "Build Phases" of your project in Xcode, update the "Link Binary With Libraries" to include the `FirestoreCounter` package. 
4. Once built, you should be able to import the `FirestoreCounter` into your project like below:

```swift
import UIKit
import FirestoreCounter
import FirebaseFirestore

class ViewController: UIViewController {
    var controller = FirestoreShardCounter(docRef: Firestore.firestore().collection("pages").document("hello-world"), field: "visits")
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // event listener which returns total amount
        controller.onSnapshot { (value, error) in
          if let error = error {
            // handle error
          } else if let value = value {
            // handle value
          }
      }
    }

    @IBAction func getLatest(_ sender: Any) {
      // get current total
        controller.get(){ (sum, error) in
          if let error = error{
            // handle error
          } else if let sum = sum {
            // handle value   
          }
        }
    }

    @IBAction func incrementer(_ sender: Any) {
      // increment every time someone visits "hello-world" page
        controller.incrementBy(val:Double(1))
    }
}

```
