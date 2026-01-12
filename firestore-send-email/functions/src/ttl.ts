/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Timestamp } from "firebase-admin/firestore";
import config from "./config";

/**
 * Calculates expiration timestamp based on TTL configuration.
 * @param startTime - The starting timestamp
 * @param ttlType - The type of TTL (hour, day, week, month, year)
 * @param ttlValue - The number of units to add
 * @returns The calculated expiration timestamp
 */
export function calculateExpireAt(
  startTime: Timestamp,
  ttlType: string,
  ttlValue: number
): Timestamp {
  const date = startTime.toDate();
  switch (ttlType) {
    case "hour":
      date.setHours(date.getHours() + ttlValue);
      break;
    case "day":
      date.setDate(date.getDate() + ttlValue);
      break;
    case "week":
      date.setDate(date.getDate() + ttlValue * 7);
      break;
    case "month":
      date.setMonth(date.getMonth() + ttlValue);
      break;
    case "year":
      date.setFullYear(date.getFullYear() + ttlValue);
      break;
    default:
      throw new Error(`Unknown TTLExpireType: ${ttlType}`);
  }
  return Timestamp.fromDate(date);
}

/**
 * Gets the expiration timestamp based on the configured TTL settings.
 * @param startTime - The starting timestamp
 * @returns The calculated expiration timestamp
 */
export function getExpireAt(startTime: Timestamp): Timestamp {
  return calculateExpireAt(
    startTime,
    config.TTLExpireType,
    config.TTLExpireValue
  );
}
