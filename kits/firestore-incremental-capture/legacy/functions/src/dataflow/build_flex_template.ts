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

import config from "../config";

import { exec } from "child_process";

/**
 * This function builds the flex template for the dataflow job,
 * but it is not used in the current implementation.
 * The reason is that gcloud CLI is not available in the cloud functions runtime,
 * hence the build process cannot be automated.
 *
 * It is included here for reference purposes.
 */
export async function buildFlexTemplateHandler() {
  const projectId = config.projectId;
  const bucketName = config.bucketName;
  const location = config.location;
  const instanceId = config.instanceId;

  // Building JAR: mvn clean package -DskipTests -Dexec.mainClass=com.pipeline.RestorationPipeline

  exec(
    `gcloud dataflow flex-template build gs://${bucketName}/dataflow-templates/${instanceId} \
        --image-gcr-path "${location}-docker.pkg.dev/${projectId}/${instanceId}/dataflow/restore:latest" \
        --sdk-language "JAVA" \
        --flex-template-base-image JAVA11 \
        --jar "path/to/pipeline.jar" \
        --env FLEX_TEMPLATE_JAVA_MAIN_CLASS="com.pipeline.RestorationPipeline" \
        --project ${projectId}`,
    (err, stdout) => {
      if (err) {
        console.log(err);
        Promise.reject(err);
      }

      Promise.resolve(stdout);
    }
  );
}
