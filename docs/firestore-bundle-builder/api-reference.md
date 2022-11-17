# API Reference

Below contains an overview of the specifications for the Bundle Builder API, including TypeScript definitions & detailed descriptions.

## BundleDocument Interface

The specification for a single document within the configured collection:

```ts
type BundleDocument = {
  // A list of document IDs to serve in the bundle.
  docs?: Array<string>;
  // A map containing individual named queries and their definitions.
  queries?: Map<string, QueryDefinition[]>;
  // A map of parameters and their definitions, which can be provided to a query definition.
  params?: Map<string, ParamDefinition>;
  // Specifies how long to keep the bundle in the client's cache, in seconds. If not defined, client-side cache is disabled.
  clientCache?: string;
  // Only used in combination with Firebase Hosting. Specifies how long to keep the bundle in Firebase Hosting CDN cache, in seconds.
  serverCache: string;
  // Specifies how long (in seconds) to keep the bundle in a Cloud Storage bucket, in seconds. If not defined, Cloud Storage bucket is not accessed.
  fileCache?: string;
  // If a 'File Cache' is specified, bundles created before this timestamp will not be file cached.
  notBefore?: Timestamp;
};
```

## ParamDefinition Interface

The specification of a single parameter defined in a `BundleDocument`.

```ts
type ParamDefinition = {
  // Whether this parameter is required. If not provided as a query string, an error will be thrown.
  required: boolean;
  // The type of value which will be parsed, defaults to ‘string’.
  type?:
    | "string"
    | "integer"
    | "float"
    | "boolean"
    | "string-array"
    | "integer-array"
    | "float-array";
};
```

For example, given the follow parameter:

```js
params: {
  name: {
    required: true,
    type: ‘string’,
  }
}
```

When making a request to the bundle HTTP endpoint, the parameter can be provided via a query parameter, e.g. `?name=david`. The parameter can be used within a `QueryDefinition` (see below) value (`$name`) to dynamically create bundles.

QueryDefinition Interface

A query definition is used to create named queries on the bundle. Each object within the `queries` map will create a new named query, using the object key as the name. Each query must specify a collection, and optionally a list of query conditions to perform.

```ts
type QueryDefinition = {
  // The collection to perform the query on.
  collection: string;
  // An optional list of conditions to perform on the specified collection.
  conditions?: QueryCondition[];
};
```

The `conditions` parameter can contain an array of `QueryCondition` interfaces. Each item in the array must only include a single condition.

```ts
type QueryCondition = {
  // Performs a `where` filter on the collection on a given FieldPath, operator and value.
  where?: [
    string,
    (
      | "<"
      | "<="
      | "=="
      | ">="
      | ">"
      | "!="
      | "array-contains"
      | "in"
      | "not-in"
      | "array-contains-any"
    ),
    any
  ];
  orderBy?: [string, ("asc" | "desc")?];
  limit?: number;
  limitToLast?: number;
  offset?: number;
  startAt?: string;
  startAfter?: string;
  endAt?: string;
  endBefore?: string;
};
```

For example, to create a query named “products” on a `products` collection with a where and limit condition, the data structure output should match the following:

```js
queries: {
  products: {
    collection: ‘products’,
    conditions: [
      { where: [‘type’, ‘==’, ‘featured’] },
      { limit: 10 },
    ],
  }
}
```

When providing array values to `in`, `not-in`, or `array-contains-any` filters, you must provide a comma separated value as the value as nested array values are not supported in Firestore. For example:

```js
{ where: [‘category’, ‘in’, ‘womens,shorts’] }, // [‘womens’, ‘shorts’]
```

Any number value will be parsed as a number, however if a string number value is required it should be wrapped in parentheses:

```js
{ where: [‘price’, ‘in’, ‘1,2.5’] }, // [1, 2.5]
{ where: [‘price’, ‘in’, ‘“1”,”2.5”’] }, // [‘1’, ‘2.5’]
```

Conditions can also be used alongside parameters. For example, if a parameter `type` is defined (see above), this can be provided to a condition value to provide dynamic data bundles via the `$` syntax:

```js
// ?type=featured


    conditions: [
      { where: [‘type’, ‘==’, ‘$type’] },
```
