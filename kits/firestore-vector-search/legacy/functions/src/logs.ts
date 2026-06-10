import {obfuscatedConfig} from './config';
import {logger} from 'firebase-functions/v1';

export function init() {
  logger.log('Initializing extension with configuration', obfuscatedConfig);
}
