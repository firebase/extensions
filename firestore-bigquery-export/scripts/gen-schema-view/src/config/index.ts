import { FirestoreSchema } from "../schema";
import { readSchemas } from "../schema-loader-utils";
import { promptInquirer } from "./interactive";
import { parseProgram, validateNonInteractiveParams } from "./non-interactive";

export interface CliConfig {
  projectId: string;
  bigQueryProjectId: string;
  datasetId: string;
  tableNamePrefix: string;
  schemas: { [schemaName: string]: FirestoreSchema };
}

export async function parseConfig(): Promise<CliConfig> {
  const program = parseProgram();
  if (program.nonInteractive) {
    if (!validateNonInteractiveParams(program)) {
      program.outputHelp();
      process.exit(1);
    }

    return {
      projectId: program.project,
      bigQueryProjectId: program.bigQueryProject || program.project,
      datasetId: program.dataset,
      tableNamePrefix: program.tableNamePrefix,
      schemas: readSchemas(program.schemaFiles),
    };
  }
  const { project, bigQueryProject, dataset, tableNamePrefix, schemaFiles } =
    await promptInquirer();

  return {
    projectId: project,
    bigQueryProjectId: bigQueryProject,
    datasetId: dataset,
    tableNamePrefix,
    schemas: readSchemas([schemaFiles]),
  };
}
