#!/bin/bash
set -e
set -o pipefail

# ---------------------------------------------------------------------
# A script to publish an NPM package from the current directory, only
# if its current version does not already exist on the NPM registry.
# ---------------------------------------------------------------------

# You can create a token via `npm token create --read-only` - note the read only flag is
# only for testing purposes (ensuring we don't accidentally publish when testing locally).
# You can also retrieve your current local token by viewing the .npmrc file, e.g. `cat ~/.npmrc`.
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
  local npm_registry_url=http://registry.npmjs.org/$1/$2

  response=$(curl --request GET \
    --url "$npm_registry_url" \
    --header 'Content-Type: application/json' \
    -s)

  # Checking if package & version was
  if [[ $response == *"version not found: $2"* ]]; then
    return 1
  fi

  if [[ $response == *"\"version\":\"$2\""* ]]; then
    return 0
  fi

  echo "Error whilst parsing NPM registry response for package $1 and version $2 at url $npm_registry_url"
  exit 1
}

# -------------------
#    Main Script
# -------------------

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
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}
npm whoami # quick check token valid - will exit if unauthorized

echo "Attempting to publish this NPM package as NPM user '$(npm whoami)'."
# TODO remove `--dry-run` once ready to go live
npm publish --dry-run
