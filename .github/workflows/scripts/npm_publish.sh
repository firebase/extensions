#!/bin/bash
set -e
set -o pipefail

# ---------------------------------------------------------------------
# A script to publish an NPM package from the current directory, only
# if its current version does not already exist on the NPM registry.
# ---------------------------------------------------------------------

# Googlers can get the npm token from http://go/npm-publish
# Uncomment for testing purposes:
#NPM_TOKEN=YOUR_TOKEN_HERE

# -------------------
#      Functions
# -------------------

# Returns 0/1 if a NPM package & version already exists on the npm registry.
#   ARGS:
#     1: NPM package name
#     2: NPM package version
npm_package_version_exists() {
  local response
  # e.g. http://registry.npmjs.org/@firebaseextensions/fs-bq-import-collection/0.1.10
  local npm_registry_url=https://registry.npmjs.org/$1/$2

  response=$(curl --request GET \
    --url "$npm_registry_url" \
    --header 'Content-Type: application/json' \
    -s)

  if [[ $response == *"version not found: $2"* ]]; then
    return 1
  fi

  # Checks the version field exists and matches current version from the returned json response.
  if [[ $response == *"\"version\":\"$2\""* ]]; then
    return 0
  fi

  echo "Error whilst parsing NPM registry response for package $1 and version $2 at url $npm_registry_url"
  exit 1
}

# -------------------
#    Main Script
# -------------------
pwd

# Confirm the current directory is actually an NPM package with a package.json file.
if ! [ -f "./package.json" ]; then
  echo "A package.json file could not be found in the current working directory."
  exit 1
fi
NPM_PACKAGE_NAME="$(node -e "console.log(require('./package.json')['name'])")"
NPM_PACKAGE_VERSION="$(node -e "console.log(require('./package.json')['version'])")"

# Ensure the package version isn't already published.
if npm_package_version_exists "$NPM_PACKAGE_NAME" "$NPM_PACKAGE_VERSION"; then
  echo "NPM package $NPM_PACKAGE_NAME and version $NPM_PACKAGE_VERSION already EXISTS on the NPM registry."
  echo "Skipping publishing of this NPM package."
  exit 0
fi

# Ensure that the NPM_TOKEN env variable is defined before we can publish the package.
if [[ -z "$NPM_TOKEN" ]]; then
  echo "Missing required NPM_TOKEN env variable. Set this on the workflow action or on your local environment."
  echo "Skipping publishing of this NPM package."
  exit 1
fi

echo "NPM package $NPM_PACKAGE_NAME and version $NPM_PACKAGE_VERSION does NOT EXIST on the NPM registry."
npm config set //wombat-dressing-room.appspot.com/:_authToken=${NPM_TOKEN}

echo "Attempting to publish $NPM_PACKAGE_NAME version $NPM_PACKAGE_VERSION..."
# This registry allows Googlers to publish with a temporary token from http://go/npm-publish
npm publish --registry https://wombat-dressing-room.appspot.com
