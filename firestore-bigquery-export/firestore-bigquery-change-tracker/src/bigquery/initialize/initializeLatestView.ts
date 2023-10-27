import { Dataset, TableMetadata } from "@google-cloud/bigquery";
import * as logs from "../../logs";
import { viewRequiresUpdate } from "../checkUpdates";
import {
  documentIdField,
  documentPathParamsField,
  RawChangelogViewSchema,
} from "../schema";
import { latestConsistentSnapshotView } from "../snapshot";
import {
  BigQueryFieldType,
  FirestoreBigQueryEventHistoryTrackerConfig,
} from "../types";

interface InitializeLatestViewParams {
  bigqueryDataset: Dataset;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  rawChangeLogTableName: string;
  rawLatestView: string;
  bqProjectId: string;
  dataFormat: BigQueryFieldType.STRING | BigQueryFieldType.JSON;
}

/**
 * Creates the latest snapshot view, which returns only latest operations
 * of all existing documents over the raw change log table.
 */
export async function initializeLatestView({
  bigqueryDataset,
  config,
  rawChangeLogTableName,
  rawLatestView,
  bqProjectId,
  dataFormat,
}: InitializeLatestViewParams) {
  const view = bigqueryDataset.table(rawLatestView);
  const [viewExists] = await view.exists();
  const schema = RawChangelogViewSchema(dataFormat);

  if (viewExists) {
    logs.bigQueryViewAlreadyExists(view.id, bigqueryDataset.id);
    const [metadata] = await view.getMetadata();
    // TODO: just casting this for now, needs properly fixing
    const fields = (metadata.schema ? metadata.schema.fields : []) as {
      name: string;
    }[];
    if (config.wildcardIds) {
      schema.fields.push(documentPathParamsField);
    }

    const columnNames = fields.map((field) => field.name);
    const documentIdColExists = columnNames.includes("document_id");
    const pathParamsColExists = columnNames.includes("path_params");
    const oldDataColExists = columnNames.includes("old_data");

    /** If new view or opt-in to new query syntax **/
    const updateView = viewRequiresUpdate({
      metadata,
      config: config,
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
        logs.addNewColumn(rawLatestView, documentIdField.name);
      }

      await view.setMetadata(metadata);
      logs.updatingMetadata(rawLatestView, {
        config: config,
        documentIdColExists,
        pathParamsColExists,
        oldDataColExists,
      });
    }
  } else {
    const schema = { fields: [...RawChangelogViewSchema(dataFormat).fields] };

    if (config.wildcardIds) {
      schema.fields.push(documentPathParamsField);
    }
    const latestSnapshot = latestConsistentSnapshotView({
      datasetId: config.datasetId,
      tableName: rawChangeLogTableName,
      schema,
      bqProjectId,
      useLegacyQuery: !config.useNewSnapshotQuerySyntax,
    });
    logs.bigQueryViewCreating(rawLatestView, latestSnapshot.query);
    const options: TableMetadata = {
      friendlyName: rawLatestView,
      view: latestSnapshot,
    };

    try {
      await view.create(options);
      await view.setMetadata({ schema: RawChangelogViewSchema(dataFormat) });
      logs.bigQueryViewCreated(rawLatestView);
    } catch (ex) {
      logs.tableCreationError(rawLatestView, ex.message);
    }
  }
  return view;
}
