Use this extension to easily deploy a chatbot using Gemini models, stored and managed by Cloud Firestore.

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
