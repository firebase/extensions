const path = require("path");

(async function () {
  require("dotenv").config({
    path: path.resolve(
      __dirname,
      "../../../_emulator/extensions/storage-transcribe-audio.env.local"
    ),
  });

  process.env.EXT_INSTANCE_ID = "storage-transcribe-audio";
})();
