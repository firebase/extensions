/**
 * Copyright 2023 Google LLC
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

package com.pipeline;

import org.joda.time.DateTime;
import org.joda.time.Days;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Utils {
  private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

  public static Instant adjustDate(Instant timestamp) {
    DateTime providedDate = new DateTime(timestamp).withSecondOfMinute(0);
    DateTime now = DateTime.now().withSecondOfMinute(0);

    int daysDiff = Days.daysBetween(providedDate.withTimeAtStartOfDay(), now.withTimeAtStartOfDay()).getDays();

    LOG.info("The provided date is " + providedDate.toString("yyyy-MM-dd HH:mm:ss"));
    LOG.info(daysDiff + " days difference between now and the provided date");

    if (providedDate.isAfterNow()) {
      // The provided date is in the future
      throw new IllegalArgumentException("The provided date is in the future!");
    }

    if (daysDiff > 7) {
      // Set the date representing 7 days before the "now" date
      return Instant.parse(now.minusDays(7).toString("yyyy-MM-dd'T'HH:mm:ss.SSS"));
    }

    return Instant.parse(providedDate.toString("yyyy-MM-dd'T'HH:mm:ss.SSS"));
  }

}
