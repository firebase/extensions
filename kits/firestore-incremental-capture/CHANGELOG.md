- Full implementation, replacing the skeleton package: Firestore capture to a BigQuery changelog, Dataflow-based point-in-time restoration, and first-deploy provisioning. See the README for differences between the legacy extension and this kit.
- The restoration pipeline is consumed as a pinned, digest-verified release of GoogleCloudPlatform/firebase-extensions (`firestore-incremental-capture-pipeline-v0.1.0`) downloaded by `scripts/setup.sh`; Maven is no longer required.
- `onHttpRunRestoration` is deployed IAM-gated: `invoker: "private"` is set explicitly, so callers need `roles/run.invoker` on the function's Cloud Run service and must send an identity token. The legacy extension deployed this endpoint publicly invocable.

## Known issues

Both are pre-existing in the legacy extension and its pipeline; neither is new in this kit.

- Array fields do not survive restore: scalar arrays restore as arrays of empty maps, and reference, binary and null elements are corrupted or dropped, while the Dataflow job reports success ([GoogleCloudPlatform/firebase-extensions#1147](https://github.com/GoogleCloudPlatform/firebase-extensions/issues/1147)).
- The restoration pipeline's `adjustDate` shifts the restore point by the JVM's timezone offset on a non-UTC JVM. Dataflow workers run UTC, so deployed jobs are unaffected ([GoogleCloudPlatform/firebase-extensions#1149](https://github.com/GoogleCloudPlatform/firebase-extensions/issues/1149)).
