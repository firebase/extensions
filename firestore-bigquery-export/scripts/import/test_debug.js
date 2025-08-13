const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();

async function checkDocs() {
  try {
    // Check documents in both partitions
    const docs0 = await firestore.collection('test_partition/0/docs').get();
    const docs1 = await firestore.collection('test_partition/1/docs').get();
    
    console.log(`Partition 0 has ${docs0.size} documents`);
    console.log(`Partition 1 has ${docs1.size} documents`);
    
    // Check collection group
    const groupDocs = await firestore.collectionGroup('docs').get();
    console.log(`Collection group 'docs' has ${groupDocs.size} total documents`);
    
    // Test getPartitions
    const query = firestore.collectionGroup('docs');
    const partitions = query.getPartitions(5);
    
    let partitionCount = 0;
    for await (const partition of partitions) {
      partitionCount++;
      const partitionQuery = partition.toQuery();
      const partitionDocs = await partitionQuery.get();
      console.log(`Partition ${partitionCount} has ${partitionDocs.size} documents`);
    }
    console.log(`Total partitions created: ${partitionCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkDocs();
