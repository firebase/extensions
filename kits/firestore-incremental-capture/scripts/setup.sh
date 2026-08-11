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
#   DATABASE_LOCATION    Location for a newly created backup database.
#                        Default "nam5".
#   LOCATION             Region for the functions and Artifact Registry.
#                        Default "us-central1".
#   BUCKET_NAME          Bucket holding the flex template. Defaults to the
#                        project's default bucket.
#   INSTANCE_ID          This instance's key in the `instances` map of the kit
#                        stanza, and the kit's INSTANCE_ID param. Must match
#                        both: it names the flex template object the deployed
#                        function launches. Default "default".
#   WORKER_SERVICE_ACCOUNT  Service account the Dataflow workers run as.
#                        Defaults to the Compute Engine default service account.
#
# This grants roles to the Dataflow *worker* service account only. The deployed
# functions run as a managed runtime service account that the Firebase CLI
# creates on first deploy and grants the roles declared with requiresRole() in
# src/index.ts - it does not exist yet while this script runs, and cannot be
# granted here.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PIPELINE_DIR="${SCRIPT_DIR}/../pipeline"

readonly PROJECT_ID="${PROJECT_ID:-}"
readonly BACKUP_INSTANCE_ID="${BACKUP_INSTANCE_ID:-}"
# The restoration pipeline reads its PITR baseline from the default database
# (RestorationPipeline.java), so that is the only database the kit can capture.
readonly SOURCE_DATABASE="(default)"
readonly DATABASE_LOCATION="${DATABASE_LOCATION:-nam5}"
readonly LOCATION="${LOCATION:-us-central1}"
readonly INSTANCE_ID="${INSTANCE_ID:-default}"
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

resolve_worker_service_account() {
  if [[ -n "${WORKER_SERVICE_ACCOUNT:-}" ]]; then
    echo "${WORKER_SERVICE_ACCOUNT}"
    return
  fi

  local project_number
  project_number="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  echo "${project_number}-compute@developer.gserviceaccount.com"
}

enable_apis() {
  step "Enabling required APIs"
  gcloud services enable \
    bigquery.googleapis.com \
    cloudbuild.googleapis.com \
    dataflow.googleapis.com \
    firestore.googleapis.com \
    artifactregistry.googleapis.com \
    storage.googleapis.com \
    compute.googleapis.com \
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

# Grants what the Dataflow workers need to run a restoration: read the changelog,
# write the backup database, and use the staging bucket. On projects where the
# default compute service account still holds Editor these are already implied,
# but org policy commonly removes that.
grant_worker_roles() {
  local service_account="$1"

  step "Granting Dataflow worker roles to ${service_account}"

  local role
  for role in \
    roles/dataflow.worker \
    roles/datastore.user \
    roles/bigquery.dataViewer \
    roles/bigquery.jobUser \
    roles/storage.objectAdmin; do
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
      --member="serviceAccount:${service_account}" \
      --role="${role}" \
      --condition=None \
      --quiet >/dev/null
  done

  ok "Worker roles granted."
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

  # APIs first: resolving the bucket and the worker account both need them.
  enable_apis

  local bucket worker_service_account jar
  bucket="$(resolve_bucket)"
  worker_service_account="$(resolve_worker_service_account)"

  enable_pitr
  create_backup_database
  create_artifact_registry
  grant_worker_roles "${worker_service_account}"
  jar="$(build_jar | tail -n 1)"
  stage_flex_template "${jar}" "${bucket}"

  echo -e "\n${GREEN}Setup complete.${NC}"
  echo
  echo "Set these in .env before deploying:"
  echo "  BACKUP_INSTANCE_ID=${BACKUP_INSTANCE_ID}"
  echo "  INSTANCE_ID=${INSTANCE_ID}"
  echo "  LOCATION=${LOCATION}"
  echo "  BUCKET_NAME=${bucket}"
  echo
  echo "The functions' own roles are granted by the Firebase CLI on first deploy."
}

main "$@"
