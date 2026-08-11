#!/usr/bin/env bash
#
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Provisions the restoration prerequisites that the deployed functions cannot
# provision themselves: they need gcloud and a Maven build, neither of which
# exists in the Cloud Functions runtime.
#
# Every step is idempotent, so re-running after a partial failure is safe.
#
# Usage:
#   PROJECT_ID=my-project BACKUP_INSTANCE_ID=my-backup ./scripts/setup.sh
#
# Required:
#   PROJECT_ID           Project holding the databases, changelog and jobs.
#   BACKUP_INSTANCE_ID   Firestore database to restore into. Created if absent.
#                        Must not be the captured database.
# Optional:
#   SOURCE_DATABASE      Captured database. Default "(default)".
#   DATABASE_LOCATION    Location for a newly created backup database.
#                        Default "nam5".
#   LOCATION             Region for the functions and Artifact Registry.
#                        Default "us-central1".
#   BUCKET_NAME          Bucket holding the flex template. Defaults to the
#                        project's default bucket.
#   INSTANCE_ID          Namespace for the deployed resources. Must match the
#                        kit's INSTANCE_ID param. Default
#                        "firestore-incremental-capture".
#   SERVICE_ACCOUNT      Runtime service account of the deployed functions.
#                        Defaults to the App Engine default service account.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PIPELINE_DIR="${SCRIPT_DIR}/../pipeline"

readonly PROJECT_ID="${PROJECT_ID:-}"
readonly BACKUP_INSTANCE_ID="${BACKUP_INSTANCE_ID:-}"
readonly SOURCE_DATABASE="${SOURCE_DATABASE:-(default)}"
readonly DATABASE_LOCATION="${DATABASE_LOCATION:-nam5}"
readonly LOCATION="${LOCATION:-us-central1}"
readonly INSTANCE_ID="${INSTANCE_ID:-firestore-incremental-capture}"
readonly JAR_NAME="restore-firestore.jar"

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

step() { echo -e "\n${YELLOW}==> $*${NC}"; }
ok() { echo -e "${GREEN}    $*${NC}"; }
die() {
  echo -e "${RED}Error: $*${NC}" >&2
  exit 1
}

require_config() {
  [[ -n "${PROJECT_ID}" ]] || die "PROJECT_ID is required."
  [[ -n "${BACKUP_INSTANCE_ID}" ]] || die "BACKUP_INSTANCE_ID is required."

  # A restoration batch-writes over the backup database. Pointing it at the
  # captured database would destroy the data being restored.
  [[ "${BACKUP_INSTANCE_ID}" != "${SOURCE_DATABASE}" ]] ||
    die "BACKUP_INSTANCE_ID must differ from SOURCE_DATABASE (${SOURCE_DATABASE})."

  command -v gcloud >/dev/null || die "gcloud is required but was not found."
  command -v mvn >/dev/null || die "Maven is required but was not found."
}

# Resolves the bucket holding the flex template. Projects created after
# September 2024 default to .firebasestorage.app; older ones to .appspot.com.
resolve_bucket() {
  if [[ -n "${BUCKET_NAME:-}" ]]; then
    echo "${BUCKET_NAME}"
    return
  fi

  local buckets
  buckets="$(gcloud storage buckets list --project="${PROJECT_ID}" --format='value(name)')"

  if grep -qx "${PROJECT_ID}.firebasestorage.app" <<<"${buckets}"; then
    echo "${PROJECT_ID}.firebasestorage.app"
  elif grep -qx "${PROJECT_ID}.appspot.com" <<<"${buckets}"; then
    echo "${PROJECT_ID}.appspot.com"
  else
    die "Could not find a default bucket for ${PROJECT_ID}. Set BUCKET_NAME."
  fi
}

resolve_service_account() {
  if [[ -n "${SERVICE_ACCOUNT:-}" ]]; then
    echo "${SERVICE_ACCOUNT}"
  else
    echo "${PROJECT_ID}@appspot.gserviceaccount.com"
  fi
}

enable_apis() {
  step "Enabling required APIs"
  gcloud services enable \
    bigquery.googleapis.com \
    cloudbuild.googleapis.com \
    dataflow.googleapis.com \
    firestore.googleapis.com \
    artifactregistry.googleapis.com \
    --project="${PROJECT_ID}"
  ok "APIs enabled."
}

# Restoration reads a PITR snapshot of the captured database, so PITR must be on
# before the point in time you later want to restore to.
enable_pitr() {
  step "Enabling point-in-time recovery on ${SOURCE_DATABASE}"
  gcloud firestore databases update \
    --database="${SOURCE_DATABASE}" \
    --enable-pitr \
    --project="${PROJECT_ID}"
  ok "PITR enabled."
}

create_backup_database() {
  step "Ensuring backup database ${BACKUP_INSTANCE_ID} exists"

  if gcloud firestore databases describe \
    --database="${BACKUP_INSTANCE_ID}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    ok "Database already exists."
    return
  fi

  gcloud firestore databases create \
    --database="${BACKUP_INSTANCE_ID}" \
    --location="${DATABASE_LOCATION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}"
  ok "Database created."
}

create_artifact_registry() {
  step "Ensuring Artifact Registry repository ${INSTANCE_ID} exists"

  if gcloud artifacts repositories describe "${INSTANCE_ID}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    ok "Repository already exists."
    return
  fi

  gcloud artifacts repositories create "${INSTANCE_ID}" \
    --repository-format=docker \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}"
  ok "Repository created."
}

grant_roles() {
  local service_account="$1"

  step "Granting Dataflow roles to ${service_account}"

  # Launching a flex template needs dataflow.developer, and needs to act as the
  # worker service account.
  local role
  for role in roles/dataflow.developer roles/iam.serviceAccountUser; do
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
      --member="serviceAccount:${service_account}" \
      --role="${role}" \
      --condition=None \
      --quiet >/dev/null
  done

  gcloud artifacts repositories add-iam-policy-binding "${INSTANCE_ID}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${service_account}" \
    --role=roles/artifactregistry.writer \
    --condition=None \
    --quiet >/dev/null

  ok "Roles granted."
}

# Built from the vendored source rather than downloaded: the prebuilt jar the
# extension fetched from GitHub is not a durable artifact.
build_jar() {
  step "Building the restoration pipeline"
  mvn -q -f "${PIPELINE_DIR}/pom.xml" clean package -DskipTests
  local jar="${PIPELINE_DIR}/target/${JAR_NAME}"
  [[ -f "${jar}" ]] || die "Expected ${jar} after the Maven build."
  ok "Built ${jar}."
  echo "${jar}"
}

# The template path must match ResolvedCaptureConfig.flexTemplatePath, which is
# what the deployed function launches.
stage_flex_template() {
  local jar="$1" bucket="$2"
  local template_path="gs://${bucket}/${INSTANCE_ID}-dataflow-restore"

  step "Staging the Dataflow flex template at ${template_path}"
  gcloud dataflow flex-template build "${template_path}" \
    --image-gcr-path "${LOCATION}-docker.pkg.dev/${PROJECT_ID}/${INSTANCE_ID}/dataflow/restore:latest" \
    --sdk-language JAVA \
    --flex-template-base-image JAVA11 \
    --jar "${jar}" \
    --env FLEX_TEMPLATE_JAVA_MAIN_CLASS="com.pipeline.RestorationPipeline" \
    --project "${PROJECT_ID}"
  ok "Template staged."
}

main() {
  require_config

  local bucket service_account jar
  bucket="$(resolve_bucket)"
  service_account="$(resolve_service_account)"

  enable_apis
  enable_pitr
  create_backup_database
  create_artifact_registry
  grant_roles "${service_account}"
  jar="$(build_jar | tail -n 1)"
  stage_flex_template "${jar}" "${bucket}"

  echo -e "\n${GREEN}Setup complete.${NC}"
  echo "Deploy the kit with BACKUP_INSTANCE_ID=${BACKUP_INSTANCE_ID}, INSTANCE_ID=${INSTANCE_ID}, LOCATION=${LOCATION}, BUCKET_NAME=${bucket}."
}

main "$@"
