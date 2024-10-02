const admin = require("firebase-admin");

// Initialize Firebase Admin with your credentials
// Make sure you've already set up your Firebase Admin SDK
admin.initializeApp({
  projectId: "vertex-testing-1efc3",
});

const firestore = admin.firestore();

async function countDocuments(collectionPath) {
  try {
    const collectionRef = firestore.collection(collectionPath);

    // Perform an aggregate query to count the documents
    const snapshot = await collectionRef.count().get();

    // Access the count from the snapshot
    const docCount = snapshot.data().count;

    console.log(
      `Number of documents in collection '${collectionPath}':`,
      docCount
    );
    return docCount;
  } catch (error) {
    console.error("Error counting documents:", error);
    throw error;
  }
}

// Call the function and pass the collection path
countDocuments("posts_2");
