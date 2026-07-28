# Transcribe Speech to Text

**Author**: Google Cloud (**[https://cloud.google.com/](https://cloud.google.com/)**)

**Description**: Transcribes audio files in Cloud Storage to .txt files using Cloud Speech To Text.



**Details**: This extension transcribes audio in Cloud Storage using Google Cloud Speech-to-Text API, and writes the resulting text output back to Cloud Storage.

Upon installation, you will be asked to provide a Storage path. New audio files (Storage objects) added to this path will trigger a Cloud Function that transcribes the audio to text, and writes it back to the same Storage path as a .txt file.

To determine if a given Storage object is an audio file, the extension checks the “Content-Type” field in the Storage Object metadata. If the Content-Type starts with “audio/” it will be considered valid for transcription.

### Use Cases

Here are a few examples of how you could use the Firebase Storage Transcribe Audio Extension:

- A podcast hosting platform could use the extension to automatically transcribe podcast episodes and make them searchable on its website.
- A company could use the extension to transcribe audio files from customer support calls and store them in Firestore for future reference.
- An education platform could use the extension to transcribe lectures and create closed captions for their students.
- A journalist could use the extension to transcribe interviews and save them in Storage for later reference.

## Additional Setup

Ensure you have a [Cloud Storage bucket](https://firebase.google.com/docs/storage) set up in your Firebase project.

## Language and Model Configuration

During the installation process, you will be asked to provide the BCP-47 code for the transcription language and select a language model. You can find the supported languages and BCP-47 codes in the [Language support documentation](https://cloud.google.com/speech-to-text/docs/languages).

The language model determines the use-case the speech-to-text transcription algorithm should be optimized for. You can find more details on the available models in the [model field documentation](https://cloud.google.com/speech-to-text/docs/reference/rest/v1/projects.locations.models). If you are unsure, you can use the default model.

## Billing

To install an extension, your project must be on the Blaze (pay as you go) plan.

You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).

This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service's no-cost tier:

- [Cloud Speech-to-Text API](https://cloud.google.com/speech-to-text#section-12)
- Cloud Storage
- Eventarc (optional)
- Cloud Functions (See [FAQs](https://firebase.google.com/support/faq#extensions-pricing))




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. Realtime Database instances are located in `us-central1`. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Cloud Storage bucket for input and output: The Cloud Storage bucket that the extension should be listening to. Files uploaded to this bucket will be transcribed by the extension. If cloud storage output is enabled, transcriptions will be written to this bucket.


* Storage path for transcriptions: The storage path in which to output transcriptions. If this is not set, the extension will output to the root of the bucket.


* Firestore collection for storing transcribed audio: The firestore collection in which to output transcriptions. If this is not set, the extension will not output the data to Firestore.


* BCP-47 code of the transcription language: The BCP-47 code of the transcription language, as shown in the [Language support documentation](https://cloud.google.com/speech-to-text/docs/languages)


* Language model used for transcription: Which kind of use-case should the speech-to-text transcription algorithm be honed for? For details, see [the model field in the documentation](https://cloud.google.com/speech-to-text/docs/reference/rest/v1/RecognitionConfig)
If you're not sure, just use the default.


* Enable automatic punctuation: Should the transcription algorithm attempt to add punctuation to the transcription? For details, see [the documentation](https://cloud.google.com/speech-to-text/docs/automatic-punctuation)




**Cloud Functions:**

* **transcribeAudio:** Listens for new audio files uploaded to a specified Cloud Storage bucket, transcribes the speech in those files, then stores the transcription in storage, or in firestore, or in both.



**APIs Used**:

* speech.googleapis.com (Reason: Used for transcribing the audio of sound files.)



**Access Required**:



This extension will operate with the following project IAM roles:

* storage.objectAdmin (Reason: Allows the extension to write to your Cloud Storage.)

* datastore.user (Reason: Allows the extension to write to your Firestore Database instance.)
