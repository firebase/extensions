import * as fs from "fs";
import {
  FirestoreSchema,
  changeLog,
  latest,
  raw,
  schema,
  userSchemaView,
} from "./schema";
import { latestConsistentSnapshotSchemaView } from "./snapshot";
import { logger } from "firebase-functions/v1";

export default function createSchemaFiles(
  datasetId: string,
  tableNamePrefix: string,
  schemaName: string,
  firestoreSchema: FirestoreSchema
) {
  try {
    const rawChangeLogTableName = changeLog(raw(tableNamePrefix));
    const latestRawViewName = latest(raw(tableNamePrefix));
    const changeLogSchemaViewName = changeLog(
      schema(tableNamePrefix, schemaName)
    );
    const latestSchemaViewName = latest(schema(tableNamePrefix, schemaName));

    /** Create the changelog view */
    const result = userSchemaView(
      datasetId,
      rawChangeLogTableName,
      firestoreSchema
    );

    /** Write out the sql file to the directory */
    const sqlFile = `${changeLogSchemaViewName}.sql`;
    const sql = result.viewInfo.query;
    fs.writeFileSync(sqlFile, sql);
    logger.info(`Written ${sqlFile}`);

    /** Create latest view */
    const latestView = latestConsistentSnapshotSchemaView(
      datasetId,
      latestRawViewName,
      firestoreSchema
    );

    /** Write out the sql file to the directory */
    const latestSqlFile = `${latestSchemaViewName}.sql`;
    const latestSql = latestView.viewInfo.query;
    fs.writeFileSync(latestSqlFile, latestSql);
    logger.info(`Written ${latestSqlFile}`);

    return;
  } catch (ex) {
    logger.error(ex?.message);
    return;
  }
}
