The `@firebaseextensions/firestore-translate-text` script is for use with the official Firebase Extension [Translate Text](https://github.com/firebase/extensions/tree/master/firestore-translate-text).

### Overview

The `@firebaseextensions/firestore-translate-text` script can read all existing documents in a specified Firestore Collection, translate the text in the specified field using [Cloud Translation API](https://cloud.google.com/translate/docs) to the specified target languages, and write the translated text to the specified output field.

#### Important notes

- You must run this script over the entire collection **_after_** installing the [Translate Text](https://github.com/firebase/extensions/tree/master/firestore-translate-text) extension; otherwise, the writes to the collection during extension installation may not be translated.

## Run the script

The import script uses several values from your installation of the extension:

- `${PROJECT_ID}`: the project ID for the Firebase project in which you installed the extension
- `${COLLECTION_PATH}`: the collection path that you specified during extension installation
- `${LANGUAGES}`: the languages that you specified during extension installation
- `${INPUT_FIELD_NAME}`: the input field name that you specified during extension installation
- `${OUTPUT_FIELD_NAME}`: the output field name that you specified during extension installation
- `${LANGUAGES_FIELD_NAME}`: the languages field name that you specified during extension installation

Run the import script using [`npx` (the Node Package Runner)](https://www.npmjs.com/package/npx) via `npm` (the Node Package Manager).

1.  Make sure that you've installed the required tools to run the import script:

    - To access the `npm` command tools, you need to install [Node.js](https://www.nodejs.org/).
    - If you use `npm` v5.1 or earlier, you need to explicitly install `npx`. Run `npm install --global npx`.

1.  Set up credentials. This script uses Application Default Credentials to communicate with the [Cloud Translation API](https://cloud.google.com/translate/docs).

    One way to set up these credentials is to run the following command using the [gcloud CLI](https://cloud.google.com/sdk/gcloud/):

    ```shell
    gcloud auth application-default login
    ```

    Alternatively, you can [create and use a service account](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually). This service account must be assigned `roles/cloudtranslate.user` role.

1.  Run the import script interactively via `npx` by running the following command:

    ```
    npx @firebaseextensions/firestore-translate-text
    ```

    **Note**: The script can be run non-interactively. To see its usage, run the above command with `--help`.
