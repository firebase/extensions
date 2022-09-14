# Development Setup

The firestore-bigquery-export extension is split out into 4 node.js packages, three of
which are hosted on [npm](https://www.npmjs.com/search?q=firebaseextensions).

**[firestore-bigquery-change-tracker](https://www.npmjs.com/package/@firebaseextensions/firestore-bigquery-change-tracker)**:
Contains the core interface defintions for document changes. Also exposes an
API for uploading changes to BigQuery. The business-logic associated with
creating the raw changelog and the latest snapshot of live documents in the
changelog also lives in this package. This package is a dependency for all 3 other packages.

**[fs-bq-import-collection](https://www.npmjs.com/package/@firebaseextensions/fs-bq-import-collection)**:
Contains a script for resumably importing a firestore collection into BigQuery
using the interface definitions in `firestore-bigquery-change-tracker`.

**[fs-bq-schema-views](https://www.npmjs.com/package/@firebaseextensions/fs-bq-schema-views)**:
Contains a script for generating BigQuery views that provide typed-checked
access to the changelog created in `firestore-bigquery-change-tracker`.

**firestore-bigquery-export-functions (a part of the extension)**: Contains the definition
for a Google Cloud function that is called on each write to some collection.
The function constructs the relevant change event and calls the API in
`firestore-bigquery-change-tracker` to upload the change to BigQuery.

## Building Locally

### Clean up any local changes (optional)

Make sure you've cleaned up and partial builds:

```
export PKGS="firestore-bigquery-change-tracker scripts/gen-schema-view scripts/import functions ."

for pkg in $PKGS;
do
  pushd . && cd $pkg && npm run clean && rm -rf node_modules
  popd
done;
```

### Local package.json file pointers

Npm supports using [local paths as
dependencies](https://docs.npmjs.com/files/package.json#local-paths) in package.json.
You'll need to update the following package.json files with local pointers to
the firestore-bigquery-change-tracker package:

1. firestore-bigquery-export/package.json
1. firestore-bigquery-export/scripts/import/package.json

This can be done with jq from the root of this extension's folder:

```
jq '.dependencies."@firebaseextensions/firestore-bigquery-change-tracker" = "file:./firestore-bigquery-change-tracker"' package.json > package.local.json
jq '.dependencies."@firebaseextensions/firestore-bigquery-change-tracker" = "file:../../firestore-bigquery-change-tracker"' scripts/import/package.json > scripts/import/package.local.json

mv package.json package.json.bak
mv scripts/import/package.json scripts/import/package.remote.json.bak

mv package.local.json package.json
mv scripts/import/package.local.json scripts/import/package.json
```

Now, build the components according to the dependency order.

```
export PKGS="firestore-bigquery-change-tracker scripts/import . scripts/gen-schema-view"

for pkg in $PKGS;
do
 pushd . && cd $pkg && npm install && npm run build
 popd
done;
```

## Publishing

_The following instructions are for Firebase team members only._

We publish 3 separate npm packages for this extension. Each follows semver, so
make sure to update the version numbers and corresponding dependencies.

For each package, `cd` into the appropriate directory, then run:

```
npm pack
npm publish
```

In general, you should publish `firestore-bigquery-change-tracker` first, since it doesn't depend on anything else, and all other packages depend on it. Follow these steps:

1. Publish the package to NPM once the PR has been approved, by checking out the branch.
1. If a critical bug fix has been made to `firestore-bigquery-change-tracker`, update the dependency version in all 3 other packages. Publish `fs-bq-import-collection` and `fs-bq-schema-views` to NPM.
1. Merge the PR to `next` branch
1. If `firestore-bigquery-export-functions` had any changes in code or `package.json`, an extension release is required.
