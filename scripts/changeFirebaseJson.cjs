const fs = require('fs');
const path = require('path');

//  get extensionName from args
// e.g node scripts/changeFirebaseJson.cjs firestore-send-email
const extensionName = process.argv[2];


const cwd = process.cwd();

const filePath = path.join(cwd,'_emulator','firebase.json'); // Adjust the path as necessary

fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Parse the JSON data
  let config = JSON.parse(data);

  // "firestore-send-email": "../firestore-send-email",
  // "delete-user-data": "../delete-user-data",
  // "storage-resize-images": "../storage-resize-images",
  // "firestore-counter": "../firestore-counter",
  // "firestore-bigquery-export": "../firestore-bigquery-export",
  // "firestore-send-email-sendgrid": "../firestore-send-email"


const extensionsFields = {
  "firestore-send-email": {
    "firestore-send-email": "../firestore-send-email",
    "firestore-send-email-sendgrid": "../firestore-send-email"
  },
  "delete-user-data": {
    "delete-user-data": "../delete-user-data"
  },
  "storage-resize-images": {
    "storage-resize-images": "../storage-resize-images"
  },
  "firestore-counter": {
    "firestore-counter": "../firestore-counter"
  },
  "firestore-bigquery-export": {
    "firestore-bigquery-export": "../firestore-bigquery-export"
  },
}

  const extensionDeclarations = extensionsFields[extensionName]; 


  // Update the extensions field
  config.extensions = extensionDeclarations;

  // Convert the modified config back to a JSON string
  const updatedJson = JSON.stringify(config, null, 2); // Including null and 2 for pretty-printing

  // Write the JSON string back to the file
  fs.writeFile(filePath, updatedJson, (err) => {
    if (err) {
      console.error('Error writing file:', err);
    } else {
      console.log('firebase.json has been updated successfully!');
    }
  });
});
