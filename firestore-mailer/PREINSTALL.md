The `firestore-mailer` extension makes it possible to send email by adding documents to a Cloud Firestore collection.
To utilize it, you will supply SMTP credentials for mail delivery and select a collection. Adding documents to a
specified collection will then trigger mail delivery:

```js
admin.firestore().collection('mail').add({
  to: ['email@example.com'],
  message: {
    subject: 'Hello from Firebase!',
    html: 'This is the <code>HTML</code> message body.',
  },
})
```

You can also use `firestore-mailer` to send messages to users with information stored in Cloud Firestore and render
email messages based on templates.
