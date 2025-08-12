import * as admin from "firebase-admin";
import { CliConfig, SerializableQuery } from "../src/types";

// Mock Firebase Admin to avoid credential issues
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      add: jest.fn().mockResolvedValue({ id: "test-doc", path: "test/test-doc" }),
      doc: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined)
      }),
      listDocuments: jest.fn().mockResolvedValue([])
    }),
    collectionGroup: jest.fn().mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      startAt: jest.fn().mockReturnThis(),
      endBefore: jest.fn().mockReturnThis(),
      getPartitions: jest.fn().mockReturnValue({
        next: jest.fn().mockResolvedValue({ value: undefined, done: true })
      })
    }),
    doc: jest.fn().mockImplementation((path) => {
      // This is where the bug occurs - if path has odd number of components
      const components = path.split('/');
      if (components.length % 2 === 1) {
        throw new Error(`Value for argument "documentPath" must point to a document, but was "${path}". Your path does not contain an even number of components.`);
      }
      return { path };
    }),
    FieldPath: {
      documentId: jest.fn().mockReturnValue("__name__")
    }
  }),
  credential: {
    applicationDefault: jest.fn()
  }
}));

const firestore = admin.firestore();

describe("Worker Bug Reproduction - Document Path Error", () => {
  
  it("should reproduce the exact error from worker.ts", async () => {
    // This test reproduces the exact scenario that causes the error in worker.ts
    
    // Simulate the problematic serialized query that would be sent to a worker
    const problematicQuery: SerializableQuery = {
      startAt: {
        before: true,
        values: [{
          referenceValue: "projects/poly-trader/databases/(default)/documents/orderbooks/0x28845a6abb595ae75aad6a50c7047660ff5552d4359ebcb00f6ffd05bb05c4c3/snapshots/E2DPYIb4JG7PQrT4LAIA",
          valueType: "reference"
        }]
      },
      endAt: {
        before: true,
        values: [{
          referenceValue: "projects/poly-trader/databases/(default)/documents/orderbooks/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef/snapshots/ABC123DEF456",
          valueType: "reference"
        }]
      }
    };

    // This is the problematic code from worker.ts lines 47-52
    const reproduceWorkerBug = () => {
      let query = firestore
        .collectionGroup("snapshots")
        .orderBy(admin.firestore.FieldPath.documentId(), "asc");

      // This is where the bug occurs - trying to create document references from paths
      if (problematicQuery.startAt?.values?.[0]?.referenceValue) {
        const startPath = problematicQuery.startAt.values[0].referenceValue;
        console.log("Attempting to create document reference from path:", startPath);
        
        // This line will throw the error because the path has odd number of components
        query = query.startAt(firestore.doc(startPath));
      }
      
      if (problematicQuery.endAt?.values?.[0]?.referenceValue) {
        const endPath = problematicQuery.endAt.values[0].referenceValue;
        console.log("Attempting to create document reference from path:", endPath);
        
        // This line will also throw the error
        query = query.endBefore(firestore.doc(endPath));
      }
      
      return query;
    };

    // Verify that the paths have odd number of components (causing the error)
    const startPath = problematicQuery.startAt?.values?.[0]?.referenceValue;
    const endPath = problematicQuery.endAt?.values?.[0]?.referenceValue;
    
    const startPathComponents = startPath?.split('/') || [];
    const endPathComponents = endPath?.split('/') || [];
    
    console.log("Start path components:", startPathComponents);
    console.log("End path components:", endPathComponents);
    console.log("Start path component count:", startPathComponents.length);
    console.log("End path component count:", endPathComponents.length);
    
    // Verify the paths have odd number of components (this is the root cause)
    expect(startPathComponents.length % 2).toBe(1);
    expect(endPathComponents.length % 2).toBe(1);
    
    // Now try to reproduce the actual error
    expect(() => {
      reproduceWorkerBug();
    }).toThrow("Value for argument \"documentPath\" must point to a document, but was");
  });

  it("should demonstrate the correct way to handle document references", async () => {
    // This test shows how the worker should handle document references correctly
    
    // Create a test document to get a proper document reference
    const testDoc = await firestore.collection("test").add({ test: true });
    const properDocRef = testDoc;
    
    // Get the path from the document reference
    const docPath = properDocRef.path;
    console.log("Proper document path:", docPath);
    
    // Verify this path has even number of components (collection/document)
    const pathComponents = docPath.split('/');
    expect(pathComponents.length % 2).toBe(0);
    
    // This should work correctly
    const query = firestore
      .collectionGroup("test")
      .startAt(firestore.doc(docPath));
    
    // Clean up
    await testDoc.delete();
  });

  it("should demonstrate the fix by extracting document paths", async () => {
    // This test validates the proposed fix for the bug
    
    // Helper function that implements the fix
    const extractDocumentPath = (resourceName: string): string => {
      // Remove the Firestore resource prefix to get just the document path
      const prefix = /^projects\/[^\/]+\/databases\/[^\/]+\/documents\//;
      return resourceName.replace(prefix, '');
    };
    
    // Test with the actual problematic paths from the error
    const problematicPaths = [
      "projects/poly-trader/databases/(default)/documents/orderbooks/0x28845a6abb595ae75aad6a50c7047660ff5552d4359ebcb00f6ffd05bb05c4c3/snapshots/E2DPYIb4JG7PQrT4LAIA",
      "projects/poly-trader/databases/(default)/documents/orderbooks/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef/snapshots/ABC123DEF456"
    ];
    
    for (const fullPath of problematicPaths) {
      console.log("Testing fix with path:", fullPath);
      
      // Extract the document path
      const extractedPath = extractDocumentPath(fullPath);
      console.log("Extracted path:", extractedPath);
      
      // Verify the extracted path has even number of components (valid document path)
      const components = extractedPath.split('/');
      expect(components.length % 2).toBe(0); // Should be even
      
      // Verify the extraction worked correctly
      expect(extractedPath).toMatch(/^orderbooks\/0x[a-f0-9]+\/snapshots\/[A-Za-z0-9]+$/);
      
      // This should NOT throw an error with the fixed path
      expect(() => {
        firestore.doc(extractedPath);
      }).not.toThrow();
    }
  });

  it("should show how the fixed worker code would work", async () => {
    // This test demonstrates how the worker.ts code should be fixed
    
    const extractDocumentPath = (resourceName: string): string => {
      const prefix = /^projects\/[^\/]+\/databases\/[^\/]+\/documents\//;
      return resourceName.replace(prefix, '');
    };
    
    // Simulate the fixed worker code
    const fixedWorkerCode = (serializableQuery: SerializableQuery) => {
      let query = firestore
        .collectionGroup("snapshots")
        .orderBy(admin.firestore.FieldPath.documentId(), "asc");
      
      // FIXED VERSION: Extract document path before creating reference
      if (serializableQuery.startAt?.values?.[0]?.referenceValue) {
        const fullPath = serializableQuery.startAt.values[0].referenceValue;
        const documentPath = extractDocumentPath(fullPath); // THE FIX
        console.log("Fixed: Using extracted path:", documentPath);
        query = query.startAt(firestore.doc(documentPath));
      }
      
      if (serializableQuery.endAt?.values?.[0]?.referenceValue) {
        const fullPath = serializableQuery.endAt.values[0].referenceValue;
        const documentPath = extractDocumentPath(fullPath); // THE FIX
        console.log("Fixed: Using extracted path:", documentPath);
        query = query.endBefore(firestore.doc(documentPath));
      }
      
      return query;
    };
    
    // Use the same problematic query from the first test
    const problematicQuery: SerializableQuery = {
      startAt: {
        before: true,
        values: [{
          referenceValue: "projects/poly-trader/databases/(default)/documents/orderbooks/0x28845a6abb595ae75aad6a50c7047660ff5552d4359ebcb00f6ffd05bb05c4c3/snapshots/E2DPYIb4JG7PQrT4LAIA",
          valueType: "reference"
        }]
      },
      endAt: {
        before: true,
        values: [{
          referenceValue: "projects/poly-trader/databases/(default)/documents/orderbooks/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef/snapshots/ABC123DEF456",
          valueType: "reference"
        }]
      }
    };
    
    // This should NOT throw an error with the fix
    expect(() => {
      fixedWorkerCode(problematicQuery);
    }).not.toThrow();
    
    console.log("✅ Fixed worker code executed successfully without errors!");
  });

  it("should analyze the partition boundary structure", async () => {
    // Create some test data to generate real partition boundaries
    const testData = [
      { id: "doc1", data: { value: 1 } },
      { id: "doc2", data: { value: 2 } },
      { id: "doc3", data: { value: 3 } }
    ];
    
    // Create documents in a structure similar to the user's scenario
    for (const item of testData) {
      await firestore
        .collection(`test_orderbooks/event1/snapshots`)
        .doc(item.id)
        .set(item.data);
    }
    
    // Create a collection group query and get partitions
    const collectionGroupQuery = firestore
      .collectionGroup("snapshots");
    
    const partitions = collectionGroupQuery.getPartitions(2); // Small batch size to get multiple partitions
    
    const partitionAnalysis: any[] = [];
    
    // Mock the partition iteration since we can't actually iterate over AsyncIterable in tests
    const mockPartitions = [
      {
        toQuery: () => ({
          _queryOptions: {
            startAt: { values: [{ referenceValue: "projects/test/databases/(default)/documents/orderbooks/event1/snapshots/doc1" }] },
            endAt: { values: [{ referenceValue: "projects/test/databases/(default)/documents/orderbooks/event2/snapshots/doc2" }] }
          }
        })
      }
    ];
    
    for (const partition of mockPartitions) {
      const query = partition.toQuery();
      const startAtPath = query._queryOptions.startAt?.values?.[0]?.referenceValue;
      const endAtPath = query._queryOptions.endAt?.values?.[0]?.referenceValue;
      
      partitionAnalysis.push({
        startAtPath,
        endAtPath,
        startAtComponents: startAtPath?.split('/') || [],
        endAtComponents: endAtPath?.split('/') || [],
        startAtComponentCount: (startAtPath?.split('/') || []).length,
        endAtComponentCount: (endAtPath?.split('/') || []).length,
        startAtIsOdd: ((startAtPath?.split('/') || []).length % 2) === 1,
        endAtIsOdd: ((endAtPath?.split('/') || []).length % 2) === 1
      });
    }
    
    console.log("Partition analysis:", JSON.stringify(partitionAnalysis, null, 2));
    
    // Verify that some partitions have problematic paths
    const problematicPartitions = partitionAnalysis.filter(p => p.startAtIsOdd || p.endAtIsOdd);
    expect(problematicPartitions.length).toBeGreaterThan(0);
    
    // Clean up
    const docs = await firestore.collection("test_orderbooks/event1/snapshots").listDocuments();
    await Promise.all(docs.map(doc => doc.delete()));
  });
});
