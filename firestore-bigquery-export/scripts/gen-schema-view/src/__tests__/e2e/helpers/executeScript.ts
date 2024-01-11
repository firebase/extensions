const path = require("path");
const { exec } = require("child_process");

export default async function executeScript(
  datasetId: string,
  tableId: string,
  schemaName: string
) {
  /** Setup paths */
  const libPath = path.normalize(__dirname + "/../../../../lib/index.js");
  const schemaPath = path.normalize(
    __dirname + `/../../../__tests__/e2e/schemas/${schemaName}`
  );

  const cmd = `node ${libPath} --project dev-extensions-testing -d ${datasetId} -t ${tableId}  -f ${schemaPath} --non-interactive`;
  console.log("Executing: ", cmd);

  function execAsync(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        const options = {
          maxBuffer: 1024 * 500, // 500KB
          shell: "/bin/bash", // Explicitly set the shell
        };

        exec(command, options, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error}`);
            console.error(`stderr: ${stderr}`);
            reject(error);
            return;
          }
          console.log(`stdout: ${stdout}`);
          resolve();
        });
      });
    });
  }

  return execAsync(cmd);
}
