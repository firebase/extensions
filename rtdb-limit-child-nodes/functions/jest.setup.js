module.exports = async function() {
  process.env = Object.assign(process.env, {
    LOCATION: "europe-west2",
    MAX_COUNT: 2,
    NODE_PATH: "test_path",
  });
};
