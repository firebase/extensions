#!/bin/bash
set -e
set -o pipefail

FIREBASE_PROJECT=$1

if [ -z "$FIREBASE_PROJECT" ]
then
FIREBASE_PROJECT="extensions-testing"
fi

npm unlink --no-save @firebaseextensions/firestore-bigquery-change-tracker > /dev/null 
pushd ../
npm install
popd

pushd ./firestore-bigquery-change-tracker > /dev/null
echo $(pwd)
npm link 
popd > /dev/null

npm link @firebaseextensions/firestore-bigquery-change-tracker
echo $(pwd)

# firebase 
