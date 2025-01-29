import { BigQuery, Table, TableMetadata } from "@google-cloud/bigquery";
import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import * as logs from "../logs";
import {
  buildMaterializedViewQuery,
  buildNonIncrementalMaterializedViewQuery,
} from "./snapshot";
import { logger } from "firebase-functions";
import * as sqlFormatter from "sql-formatter";

interface InitializeLatestMaterializedViewOptions {
  bq: BigQuery;
  changeTrackerConfig: FirestoreBigQueryEventHistoryTrackerConfig;
  view: Table;
  viewExists: boolean;
  rawChangeLogTableName: string;
  rawLatestViewName: string;
  schema?: any;
}

export async function shouldRecreateMaterializedView(
  view: Table,
  config: FirestoreBigQueryEventHistoryTrackerConfig,
  source: string
): Promise<boolean> {
  const [viewMetadata] = await view.getMetadata();

  const isIncremental = !(viewMetadata as TableMetadata).materializedView
    ?.allowNonIncrementalDefinition;

  const incrementalMatch =
    isIncremental === !!config.useIncrementalMaterializedView;

  const viewQuery =
    (viewMetadata as TableMetadata).materializedView?.query || "";

  const queryMatch =
    sqlFormatter.format(viewQuery) === sqlFormatter.format(source);

  return !queryMatch || !incrementalMatch;
}

/**
 * Creates the latest materialized view.
 */
export async function initializeLatestMaterializedView({
  bq,
  changeTrackerConfig: config,
  view,
  viewExists,
  rawChangeLogTableName,
  rawLatestViewName,
  schema,
}: InitializeLatestMaterializedViewOptions): Promise<Table> {
  try {
    const { query, source } = config.useIncrementalMaterializedView
      ? buildMaterializedViewQuery({
          projectId: bq.projectId,
          datasetId: config.datasetId,
          tableName: rawChangeLogTableName,
          rawLatestViewName,
          schema,
        })
      : buildNonIncrementalMaterializedViewQuery({
          projectId: bq.projectId,
          datasetId: config.datasetId,
          tableName: rawChangeLogTableName,
          maxStaleness: config.maxStaleness,
          refreshIntervalMinutes: config.refreshIntervalMinutes,
          rawLatestViewName,
          enableRefresh: true,
          schema,
        });

    const desiredQuery = sqlFormatter.format(query);

    if (viewExists) {
      const shouldRecreate = await shouldRecreateMaterializedView(
        view,
        config,
        source
      );

      if (!shouldRecreate) {
        logger.warn(
          `Materialized view requested, but a view with matching configuration exists. Skipping creation.`
        );
        return view;
      }

      logger.warn(
        `Configuration mismatch detected for ${rawLatestViewName} ` +
          `Recreating view...`
      );

      await view.delete();

      return await initializeLatestMaterializedView({
        bq,
        changeTrackerConfig: config,
        view,
        viewExists: false,
        rawChangeLogTableName,
        rawLatestViewName,
        schema,
      });
    }

    logs.bigQueryViewCreating(rawLatestViewName, desiredQuery);
    await bq.query(desiredQuery);

    logs.bigQueryViewCreated(rawLatestViewName);
  } catch (error) {
    logs.tableCreationError(rawLatestViewName, error.message);
    throw error;
  }

  return view;
}
