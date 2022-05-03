# Cross-Project Support

If you specified an `alternative` project parameter during configuration of the extension, BigQuery will sync data to tables and views in the defined project.

## Example Scenario

A typical scenario for this would be to install multiple instances of the extension to share the data across multiple (separate) instances without having to support multiple Firestore instances.
