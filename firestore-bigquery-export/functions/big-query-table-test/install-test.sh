#!/bin/bash
set -e
set -o pipefail

FIREBASE_PROJECT=${1:-"extensions-testing"}
EXTENSION_INSTANCE_ID=${2:-"firestore-bigquery-export"}
PARAMS=${3:-"install-params.env"}
COLLECTION=${4:-"bigQueryProductionTests"}
TEST_DIRECTORY=`basename $PWD`
TRACKER="firestore-bigquery-change-tracker"
EXTENSION="firestore-bigquery-export"


# delete node_modules for firestore-bigquery-change-tracker manually to get around typescript binary being removed
pushd ../../$TRACKER > /dev/null
echo "Running: removing node_modules from @firebaseextensions/${TRACKER}"
rm -rf node_modules
echo "Success: removed node_modules from @firebaseextensions/$TRACKER"
popd > /dev/null

# go into firestore-bigquery-export directory and unlink firestore-bigquery-change-tracker pakage
pushd ../ > /dev/null
echo "Running: 'npm unlink --no-save @firebaseextensions/$TRACKER'"
npm unlink --no-save @firebaseextensions/$TRACKER --loglevel=error > /dev/null 
echo "Success: unlinked @firebaseextensions/$TRACKER package"

# go into root directory and install & build all packages via lerna
echo "Running: 'npm install' in root directory"
pushd ../../ > /dev/null
npm install --loglevel=error > /dev/null
echo "Success: finished running 'npm install' in root directory"

popd > /dev/null

# register firestore-bigquery-change-tracker for symlinking
pushd ../$TRACKER > /dev/null
echo "Running: 'registering $TRACKER'"
npm link --loglevel=error > /dev/null
popd > /dev/null
echo "Success: register $TRACKER as a linkable package"

# symlink firestore-bigquery-export with firestore-bigquery-change-tracker
echo "Running: 'symlinking $TRACKER to $EXTENSION"
npm link @firebaseextensions/$TRACKER --loglevel=error > /dev/null
echo "Success: $TRACKER package is linked to $EXTENSION"

pushd ../ > /dev/null

# list installed extension to find out if default BigQuery extension is already installed. Uninstall if it exists.
INSTALLED_EXTENSIONS=$(firebase ext:list --project=$FIREBASE_PROJECT)
if echo $INSTALLED_EXTENSIONS | grep -q "$EXTENSION_INSTANCE_ID\s"; then
echo "Running: uninstalling $EXTENSION test extension: $EXTENSION_INSTANCE_ID"
firebase ext:uninstall $EXTENSION_INSTANCE_ID --project=$FIREBASE_PROJECT -f
echo "Success: uninstalled $EXTENSION_INSTANCE_ID from $FIREBASE_PROJECT" 
fi

# install BigQuery extenstion with latest changes to test
echo "Running: installing '$EXTENSION' test extension using instanceId: $EXTENSION_INSTANCE_ID"
firebase ext:install . --params=./functions/$TEST_DIRECTORY/$PARAMS --project=$FIREBASE_PROJECT
echo "Success: installed $EXTENSION_INSTANCE_ID from $FIREBASE_PROJECT"

# add data to the Firestore collection to test the backwards compatibility of latest BigQuery extension update
echo "Running: adding data to the Firestore collection: $COLLECTION"
node ./functions/$TEST_DIRECTORY/install-script.js $FIREBASE_PROJECT $COLLECTION
echo "Success: added data to the Firestore collection: $COLLECTION"

# sleep for 20 seconds whilst waiting for logs to update
sleep 20s

# grab recent logs for BigQuery test extension
echo "Cloud function logs for $EXTENSION_INSTANCE_ID:"
firebase functions:log --project=$FIREBASE_PROJECT | grep "$EXTENSION_INSTANCE_ID"
