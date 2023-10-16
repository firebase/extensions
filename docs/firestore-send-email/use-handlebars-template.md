# Use Handlebars templates

## Use Handlebars templates with the Trigger Email from Firestore extension

If you specified a "Templates collection" parameter during configuration of the extension, you can create and manage [Handlebars templates](https://handlebarsjs.com/) templates for your emails.

## Template collection structure

Give each document a memorable ID that you use as the *template name* in the documents you write to your templates collection.

The template document can include any of the following fields:

- **subject:** A template string for the subject of the email.
- **text:** A template string for the plaintext content of the email.
- **html:** A template string for the HTML content of the email.
- **amp:** A template string for the [AMP4EMAIL](https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/) content of the email.
- **attachments:** An array of attachments with template strings as values; [Nodemailer options](https://nodemailer.com/message/attachments/) supported: utf-8 string, custom content type, URL, encoded string, data URI, and pre-generated MIME node (be aware that your email has no access to the cloud server's file system).

An example template might have an ID of `following` and content like:

```jsx
{
  subject: "@{{username}} is now following you!",
  html: "Just writing to let you know that <code>@{{username}}</code> ({{name}}) is now following you.",
  attachments: [
    {
     filename: "{{username}}.jpg",
     path: "{{imagePath}}"
    }
  ]
}
```

## Send emails using templates

To deliver email using templates, when adding documents to your mail collection, include a `template` field with `name` and `data` properties. For example, using our `following` template from above:

```jsx
admin
  .firestore()
  .collection("MAIL_COLLECTION")
  .add({
    toUids: ["abc123"],
    template: {
      name: "following",
      data: {
        username: "ada",
        name: "Ada Lovelace",
        imagePath: "https://example.com/path/to/file/image-name.jpg",
      },
    },
  });
```

## Template Partials

You can compose templates using reusable [partials](https://handlebarsjs.com/guide/partials.html) by specifying `{partial: true}` in the template document. Each of the standard data fields (`subject`, `html`, `text`, and `amp`) will be defined as a partial used only in its own environment. For example, a partial called `footer` might have data like:

```jsx
{
  partial: true,
  html: "<p>This mail was sent by ExampleApp, Inc. <a href='https://example.com/unsubscribe'>Unsubscribe</a></p>",
  text: "This mail was sent by ExampleApp, Inc. Unsubscribe here: https://example.com/unsubscribe"
}
```

In another template, include the partial by referencing its name (document ID):

```html
<p>This is my main template content, but it will use a common footer.</p>

{{> footer }}
```
