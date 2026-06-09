import path from "path";

(async function () {
  const $ = path.resolve(
    __dirname,
    `../../../_emulator/extensions/delete-user-data.env.local`
  );

  require("dotenv").config({
    path: path.resolve(
      __dirname,
      `../../../_emulator/extensions/delete-user-data.env.local`
    ),
  });
})();
