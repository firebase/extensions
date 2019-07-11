## Final step

To finish the installation please set up a cloud scheduler job to call the controller function every minute. You can do it by running the following gcloud command.

```
gcloud scheduler jobs create http firestore-sharded-counter-controller --schedule="* * * * *" --uri=${function:controller.url} --project=${param:PROJECT_ID}
```
