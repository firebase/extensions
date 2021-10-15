#!/bin/bash

# Fail on any error.
set -e

PUBLISHER_ID=$1
EXTENSIONS="delete-user-data,firestore-bigquery-export,firestore-counter,firestore-send-email,firestore-shorten-urls-bitly,firestore-translate-text,rtdb-limit-child-nodes,storage-resize-images"

if [ -z "$PUBLISHER_ID" ]
then
  echo "\$PUBLISHER_ID is not defined"
  exit 1
else
  echo "Publishing $EXTENSIONS into $PUBLISHER_ID."
fi

REPO_ROOT="`( cd \`dirname \"$0\"\` && cd .. && pwd )`"

cd "$REPO_ROOT"
npm install
if [ ! -z "$IGNORE_TEST_FAILURES" ]
then
  echo "Ignoring failing tests."
  set +e
fi

npm test

set +e
IFS=',' read -ra EXTENSIONS_SPLIT <<< "$EXTENSIONS"
for i in "${EXTENSIONS_SPLIT[@]}"; do
  echo "-------------------------------"
  echo "- Publishing $PUBLISHER_ID/$i."
  echo "-------------------------------"
  cd "$REPO_ROOT/$i"
  firebase ext:dev:publish $PUBLISHER_ID/$i --non-interactive --force
  EXIT_CODE=$?
  # Exit code 103 means that version already published, move on.
  [ $EXIT_CODE -eq 0  ] || [ $EXIT_CODE -eq 103 ]  || exit 1
done