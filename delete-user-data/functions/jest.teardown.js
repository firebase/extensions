module.exports = async function() {
  delete process.env.LOCATION;
  delete process.env.FIRESTORE_PATHS;
  delete process.env.FIRESTORE_DELETE_MODE;
  delete process.env.RTDB_PATHS;
  delete process.env.STORAGE_PATHS;
  delete process.env.STORAGE_BUCKET;
  delete process.env.SELECTED_DATABASE_INSTANCE;
};
