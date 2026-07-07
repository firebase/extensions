const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("Bootstrapping packages...");

// 1. Run npm install in each package
execSync("npx lerna exec --concurrency 4 -- npm install", { stdio: "inherit" });

// 2. Create symlinks for firestore-bigquery-change-tracker
const source = path.resolve(
  __dirname,
  "../firestore-bigquery-export/firestore-bigquery-change-tracker"
);
const targets = [
  "../firestore-bigquery-export/functions/node_modules/@firebaseextensions/firestore-bigquery-change-tracker",
  "../firestore-bigquery-export/scripts/import/node_modules/@firebaseextensions/firestore-bigquery-change-tracker",
  "../firestore-bigquery-export/scripts/gen-schema-view/node_modules/@firebaseextensions/firestore-bigquery-change-tracker",
];

for (const targetRelative of targets) {
  const target = path.resolve(__dirname, targetRelative);
  const targetDir = path.dirname(target);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.symlinkSync(source, target, "dir");
  console.log(
    `Created symlink: ${targetRelative} -> firestore-bigquery-change-tracker`
  );
}

console.log("Bootstrapping completed successfully!");
