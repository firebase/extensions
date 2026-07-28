# @firebase/rtdb-limit-child-nodes

Limit the number of child nodes under a Realtime Database path

> First prototype of the npm-shared v2 Firebase Function migrated from the
> `rtdb-limit-child-nodes` Firebase Extension.

## Entry points

- `@firebase/rtdb-limit-child-nodes` for the env-driven Firebase Functions
  entry that reads deploy-time params, registers `rtdblimit`, and re-exports
  the library surface.
- `@firebase/rtdb-limit-child-nodes/lib` for the side-effect-free typed library
  surface.

The root entry keeps trigger-bound fields deploy-time safe: `NODE_PATH`,
`SELECTED_DATABASE_INSTANCE`, and `LOCATION` are passed to Firebase Functions as
param expressions/objects for trigger discovery, while `configFromEnv()` is
deferred until the first invocation.

`SELECTED_DATABASE_INSTANCE` is explicit in the params workflow. Set it in
`.env`, `.env.<projectId>`, or via the Firebase CLI prompt so the trigger
always binds to the intended Realtime Database instance.

## Status

This package now includes:

- a typed config surface with defaults
- a pure trim handler
- a v2 Realtime Database entrypoint
- a deployable example under [`examples/rtdb-limit-child-nodes`](../../examples/rtdb-limit-child-nodes)

Remaining acceptance work is mainly repo-wide verification (`pnpm build`,
`pnpm lint`, `pnpm test`) and scratch-project deployment.

Track the reference implementation in
[`packages/firestore-bigquery-export`](../firestore-bigquery-export) and the
design in [`docs/rfc.md`](../../docs/rfc.md).
