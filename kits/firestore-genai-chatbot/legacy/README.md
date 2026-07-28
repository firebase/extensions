# Build Chatbot with the Gemini API

**Author**: Google Cloud (**[https://cloud.google.com/](https://cloud.google.com/)**)

**Description**: Deploys customizable chatbots using Gemini models and Firestore.



**Details**: Use this extension to easily deploy a chatbot using Gemini models, stored and managed by Cloud Firestore.

On install you will be asked to provide:

- **Gemini API Provider** This extension makes use of the Gemini family of models. Currently the extension supports the Google AI Gemini API and the Vertex AI Gemini API. Learn more about the differences between the Google AI and Vertex AI Gemini APIs [here](https://cloud.google.com/vertex-ai/docs/generative-ai/migrate/migrate-google-ai).

Note that Generative AI on Vertex AI is only available in the regions listed [here](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/locations-genai).

A list of languages and regions supported by the Gemini API on Google AI is [here](https://ai.google.dev/available_regions).

- **Gemini Model**: Input the name of the Gemini model you would like to use. To view available models for each provider, see:
- [Vertex AI Gemini models](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models)
- [Google AI Gemini models](https://ai.google.dev/models/gemini)

- **Firestore Collection Path**: Used to store conversation history represented as documents. This extension will listen to the specified collection(s) for new message documents.

The collection path also supports wildcards, so you can trigger the extension on multiple collections, each with their own private conversation history. This is useful if you want to create separate conversations for different users, or support multiple chat sessions.

Message documents might look like this:

```
{
  prompt: "What is the best museum to visit in Barcelona, Spain?"
}
```

When a message document is added, the extension will:

- Obtain conversation history by sorting the documents of the collection.
- Query the language model you selected during configuration.
- Write the message back to the triggering document in a configurable response field.

A createTime field (or a field by another name if provided during installation) will be automatically created for you on document creation, and will be used to order the conversation history. The chosen generative model will have a limited context window, so only the most recent messages will be used as history to generate the next response. Alternatively, If documents in the specified collection already contain a field representing timestamps, you can use that as the order field instead.

You can configure the chatbot to return different responses by providing context during installation. For example, if you want the chatbot to act as a travel guide, you might use this as the context:

```
I want you to act as a travel guide. I will ask you questions about various travel destinations, and you will describe those destinations and give me suggestions on places to visit.
```

You can also configure the model to return different results by tweaking model parameters (temperature, candidate count, etc.), which are exposed as configuration during install as well.

## Additional Setup

Ensure you have a [Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) set up in your Firebase project, set up in your Firebase project, and have obtained an API key for the Gemini API.

### Regenerating a response

Changing the state field of a completed document's status from `COMPLETED` to anything else will retrigger the extension for that document.

### Genkit Monitoring

This extension supports Genkit monitoring, which provides detailed insights into the performance and behavior of your chatbot. When enabled, Genkit monitoring will:

- Track model response times and latency
- Monitor token usage and costs
- Provide visibility into model behavior and safety settings
- Help identify potential issues or optimization opportunities

To enable Genkit monitoring, set the `Enable Genkit Monitoring` configuration parameter to `yes` during installation. Note that enabling this feature may incur additional costs depending on your usage.

### Conversational AI with Genkit

This extension leverages the [Genkit SDK](http://genkit.dev/) to enable conversational AI features powered by Gemini models from Google AI and Vertex AI. Genkit handles model selection, chat history formatting, prompt construction, and response generation. This allows you to easily build and customize Firestore-backed AI chatbots.

For more information about Genkit, visit the Genkit documentation at [genkit.dev](http://genkit.dev/).

## Billing

To install an extension, your project must be on the Blaze (pay as you go) plan. You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service's no-cost tier:

- Cloud Firestore
- Cloud Functions (See [FAQs](https://firebase.google.com/support/faq#extensions-pricing))
- Associated costs for using Vertex AI ([see their pricing](https://cloud.google.com/vertex-ai/pricing#generative_ai_models)) if you use this provider.
- Associated costs for using Google AI ([see their pricing](https://ai.google.dev/pricing)) if you use this provider.

[Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Gemini API Provider: This extension makes use of the Gemini family of generative models. For Google AI you will require an API key, whereas Vertex AI will authenticate using application default credentials. For more information see the [docs](https://firebase.google.com/docs/admin/setup#initialize-sdk).

* Google AI API Key: If you have selected Google AI as your provider, then this parameteris required. If you have instead selected Vertex AI, then this parameter is not required, and application default credentials will be used.

* Gemini model: Input the name of the Gemini model you would like to use. To view available models for each provider, see: [Vertex AI Gemini models](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models), [Google AI Gemini models](https://ai.google.dev/models/gemini). Note: Any models in preview on Vertex AI will require Vertex AI Model Location to be set to 'global'.

* Cloud Functions Location: Where do you want to deploy the functions created for this extension? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations). Note that Generative AI on Vertex AI is only available in the regions listed [here](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/locations-genai). A list of languages and regions supported by the Gemini API on Google AI is [here](https://ai.google.dev/available_regions).

* Vertex AI Model Location: If you are using Vertex AI as your provider, which location should be used for the Vertex AI API? This can differ from the Cloud Functions location.
If not specified, defaults to the Cloud Functions location. Note: Models in preview on Vertex AI require 'Global'. See [available locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).

* Firestore Collection Path: Used to store conversation history represented as documents. This extension will listen to the specified collection(s) for new message documents.

* Prompt Field: The field in the message document that contains the prompt.

* Response Field: The field in the message document into which to put the response.

* Order Field: The field by which to order when fetching conversation history. If absent when processing begins, the current timestamp will be written to this field. Sorting will be in descending order.

* Context: Contextual preamble for the generative AI model. A string giving context for the discussion.

* Temperature: Controls the randomness of the output. Values can range over [0,1], inclusive. A value closer to 1 will produce responses that are more varied, while a value closer to 0 will typically result in less surprising responses from the model.

* Nucleus sampling probability: If specified, nucleus sampling will be used as the decoding strategy. Nucleus sampling considers the smallest set of tokens whose probability sum is at least a fixed value. Enter a value between 0 and 1.

* Sampling strategy parameter: If specified, top-k sampling will be used as the decoding strategy. Top-k sampling considers the set of topK most probable tokens.

* Candidate count: The default value is one. When set to an integer higher than one, additional candidate responses, up to the specified number, will be stored in Firestore under the 'candidates' field.

* Max Output Tokens: If specified, this parameter is passed to the Gemini API to control the length of the response.

* Candidates field: The field in the message document into which to put the other candidate responses if the candidate count parameter is greater than one.

* Enable per document overrides.: If set to \"Yes\", discussion parameters may be overwritten by fields in the discussion collection.

* Enable Genkit Monitoring: If set to "Yes", enables Genkit Monitoring for collecting and viewing real-time telemetry data. This requires the Cloud Logging API, Cloud Trace API, and Cloud Monitoring API to be enabled, and appropriate IAM roles to be configured. See the documentation for more details.

* Hate Speech Threshold: Threshold for hate speech content. Specify what probability level of hate speech content is blocked by the Gemini provider.

* Dangerous Content Threshold: Threshold for dangerous content. Specify what probability level of dangerous content is blocked by the Gemini provider.

* Harassment Content Threshold: Threshold for harassment content. Specify what probability level of harassment content is blocked by the Gemini provider.

* Sexual Content Threshold: Threshold for sexually explicit content. Specify what probability level of sexual content is blocked by the Gemini provider.



**Cloud Functions:**

* **generateMessage:** Listens to Firestore data writes to generate conversations.



**APIs Used**:

* aiplatform.googleapis.com (Reason: For access to the Vertex AI Gemini API if this provider is chosen.)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows this extension to access Cloud Firestore to read and process added messages.)

* aiplatform.user (Reason: Allows this extension to access the Vertex AI API if this provider is chosen.)

* monitoring.metricWriter (Reason: Allows this extension to write metrics to Cloud Monitoring when Genkit Monitoring is enabled.)

* cloudtrace.agent (Reason: Allows this extension to write trace data to Cloud Trace when Genkit Monitoring is enabled.)

* logging.logWriter (Reason: Allows this extension to write logs to Cloud Logging when Genkit Monitoring is enabled.)
