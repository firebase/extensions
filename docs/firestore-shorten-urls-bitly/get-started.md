# Get started

## Use the Shorten URLs in Firestore extension

The Shorten URLs in Firestore extension (`firestore-shorten-urls-bitly`) lets you create shortened URLs from URLs written to Cloud Firestore. These shortened URLs are useful as display URLs.

This extension listens to your specified Cloud Firestore collection. If you add a URL to a specified field in any document within that collection, this extension:

- Shortens the URL.
- Saves the shortened URL in a new specified field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This extension uses [Bitly](https://bitly.com/) to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation.

## **Pre-installation setup**

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

You must also have a [Bitly account](https://app.bitly.com/) and [access token](https://bitly.com/a/oauth_apps) before installing this extension.

## Install the extension

To install the extension, follow the steps on the [Install a Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions)
 page. In summary, do one of the following:

- **Firebase console:** Click the following button:

  [Install the Shorten URLs in Firestore extension](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Ffirestore-shorten-urls-bitly)

- **CLI:** Run the following command:

  ```bash
  firebase ext:install firebase/firestore-bigquery-export --project=projectId-or-alias
  ```

During installation, you will be prompted to specify a number of configuration parameters:

- **Cloud Functions location:**

  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

- **Bitly access token:**

  What is your Bitly access token? Generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

- **Collection path:**

  What is the path to the collection that contains the URLs that you want to shorten?

- **URL field name:**

  What is the name of the field that contains the original long URLs that you want to shorten?

- **Short URL field name:**

  What is the name of the field where you want to store your shortened URLs?
