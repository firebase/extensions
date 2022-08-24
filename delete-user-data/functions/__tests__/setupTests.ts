const waitPort = require("wait-port");

beforeEach(async () => {
  /** Wait for the emulator to initialize */
  await Promise.all([
    waitPort({ port: 9099, interval: 10000, output: "silent" }, 2000),
  ]);
}, 20000);
