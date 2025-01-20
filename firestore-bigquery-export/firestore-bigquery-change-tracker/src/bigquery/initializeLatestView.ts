import {
  BigQuery,
  Dataset,
  Table,
  TableMetadata,
} from "@google-cloud/bigquery";
import {
  documentIdField,
  documentPathParams,
  RawChangelogViewSchema,
} from "./schema";
import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import * as logs from "../logs";
import { latestConsistentSnapshotView } from "./snapshot";
import { viewRequiresUpdate } from "./checkUpdates";

interface InitializeLatestViewOptions {
  bq: BigQuery;
  changeTrackerConfig: FirestoreBigQueryEventHistoryTrackerConfig;
  dataset: Dataset;
  view: Table;
  viewExists: boolean;
  rawChangeLogTableName: string;
  rawLatestViewName: string;
}

/**
 * Creates the latest snapshot view, which returns only latest operations
 * of all existing documents over the raw change log table.
 */
export async function initializeLatestView({
  changeTrackerConfig: config,
  dataset,
  view,
  viewExists,
  rawChangeLogTableName,
  rawLatestViewName,
  bq,
}: InitializeLatestViewOptions): Promise<Table> {
  const schema = RawChangelogViewSchema;

  if (viewExists) {
    logs.bigQueryViewAlreadyExists(view.id, dataset.id);
    const [metadata] = await view.getMetadata();
    // TODO: just casting this for now, needs properly fixing
    const fields = (metadata.schema ? metadata.schema.fields : []) as {
      name: string;
    }[];
    if (config.wildcardIds) {
      schema.fields.push(documentPathParams);
    }

    const columnNames = fields.map((field) => field.name);
    const documentIdColExists = columnNames.includes("document_id");
    const pathParamsColExists = columnNames.includes("path_params");
    const oldDataColExists = columnNames.includes("old_data");

    /** If new view or opt-in to new query syntax **/
    const updateView = viewRequiresUpdate({
      metadata,
      config,
      documentIdColExists,
      pathParamsColExists,
      oldDataColExists,
    });

    if (updateView) {
      metadata.view = latestConsistentSnapshotView({
        datasetId: config.datasetId,
        tableName: rawChangeLogTableName,
        schema,
        useLegacyQuery: !config.useNewSnapshotQuerySyntax,
      });

      if (!documentIdColExists) {
        logs.addNewColumn(rawLatestViewName, documentIdField.name);
      }

      await view.setMetadata(metadata);
      logs.updatingMetadata(rawLatestViewName, {
        config: config,
        documentIdColExists,
        pathParamsColExists,
        oldDataColExists,
      });
    }
  } else {
    const schema = { fields: [...RawChangelogViewSchema.fields] };

    if (config.wildcardIds) {
      schema.fields.push(documentPathParams);
    }
    const latestSnapshot = latestConsistentSnapshotView({
      datasetId: config.datasetId,
      tableName: rawChangeLogTableName,
      schema,
      bqProjectId: bq.projectId,
      useLegacyQuery: !config.useNewSnapshotQuerySyntax,
    });
    logs.bigQueryViewCreating(rawLatestViewName, latestSnapshot.query);
    const options: TableMetadata = {
      friendlyName: rawLatestViewName,
      view: latestSnapshot,
    };

    try {
      await view.create(options);
      await view.setMetadata({ schema: RawChangelogViewSchema });
      logs.bigQueryViewCreated(rawLatestViewName);
    } catch (ex) {
      logs.tableCreationError(rawLatestViewName, ex.message);
    }
  }
  return view;
}
