import { FirestoreSchema } from "../schema";
import { readSchemas } from "../schema-loader-utils";
import { promptInquirer } from "./interactive";
import { parseProgram, validateNonInteractiveParams } from "./non-interactive";

const DEFAULT_SAMPLE_SIZE = 100;

interface CliConfig {
  projectId: string;
  bigQueryProjectId: string;
  datasetId: string;
  tableNamePrefix: string;
  // TODO: isn't this the same as tableNamePrefix? check.
  collectionPath?: string;
  schemas: { [schemaName: string]: FirestoreSchema };
  useGemini?: boolean;
  agentSampleSize?: number;
  googleAiKey?: string;
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
      collectionPath: program.collectionPath,
      schemas: readSchemas(program.schemaFiles),
      useGemini: program.useGemini,
      agentSampleSize: DEFAULT_SAMPLE_SIZE,
      googleAiKey: program.googleAiKey,
    };
  }
  const {
    project,
    bigQueryProject,
    dataset,
    tableNamePrefix,
    schemaFiles,
    collectionPath,
    useGemini,
    // TODO: rename?
    googleAiKey,
  } = await promptInquirer();

  return {
    projectId: project,
    bigQueryProjectId: bigQueryProject,
    datasetId: dataset,
    tableNamePrefix: tableNamePrefix,
    collectionPath: collectionPath,
    schemas: readSchemas(
      schemaFiles.split(",").map((schemaFileName) => schemaFileName.trim())
    ),
    useGemini: useGemini,
    agentSampleSize: DEFAULT_SAMPLE_SIZE,
    googleAiKey: googleAiKey,
  };
}
