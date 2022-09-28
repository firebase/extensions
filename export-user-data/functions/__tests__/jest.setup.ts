import * as path from "path";

(async function() {
  require("dotenv").config({
    path: path.resolve(
      __dirname,
      "../../../_emulator/extensions/firestore-notice-extension.env.local"
    ),
  });

  process.env.EXT_INSTANCE_ID = "firestore-notice-extension";
})();
