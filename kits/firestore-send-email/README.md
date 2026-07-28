# @firebase/firestore-send-email

Send emails based on documents written to Firestore

This package ports the `firestore-send-email` Firebase Extension to an npm-shared
Firebase Function built on Cloud Functions for Firebase v2.

It exports:

- `processQueue` from the default clone-and-deploy entry point in `src/index.ts`.
- A side-effect-free `./lib` surface for config helpers, handlers, payload
  preparation, template rendering, and transport setup.

Secret-backed params follow the extension migration pattern:

- `SMTP_PASSWORD`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

These secrets are declared with `defineSecret`, passed to the trigger through
`secrets: [...]`, and only resolved at runtime via `.value()`. That allows
existing Secret Manager secrets to be reused during migration instead of forcing
 operators to re-enter them.
