// import {obfuscatedConfig} from '../config';
import {logger} from 'firebase-functions/v1';

export function backfillNotEnabled() {
  logger.log('Backfill is not enabled. Terminating backfill process early.');
}

export function backfillNotRequired() {
  logger.log(
    'Backfill is not required, embeddings do not need recalculating. Terminating backfill process early.'
  );
}
