/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState } from "react";
import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import qs from "qs";
import { Label } from "~/components/Label";
import { createBundle, getBundle } from "~/firebase.server";
import type { Bundle } from "~/types";
import { Button } from "~/components/Button";
import { TrashIcon } from "~/components/icons";
import { Input } from "~/components/form";

export const action: ActionFunction = async ({ request }) => {
  const text = await request.text();
  const form = qs.parse(text);

  const id = form.id as string;

  if (await getBundle(id)) {
    return json({
      errors: {
        id: "Bundle with that ID already exists!",
      },
      form,
    });
  }

  const data: Omit<Bundle, "id"> = {
    clientCache: (form.clientCache as string) || null,
    serverCache: (form.serverCache as string) || null,
    fileCache: (form.fileCache as string) || null,
    docs: form.docs ? (form.docs as string).split(",") : null,
    params: {},
    queries: {},
  };

  if (Array.isArray(form.params)) {
    for (const _param of form.params) {
      const param = _param as any;
      const { name, required, type } = param;

      if (!name) {
        continue;
      }

      data.params![name] = {
        required: required === "true",
        type: type || "string",
      };
    }
  }


  if (Array.isArray(form.query)) {
    for (const _query of form.query) {
      const query = _query as any;
      const id = query.id;
      const collection = query.collection;

      if (!id || !collection) {
        continue;
      }

      data.queries![id] = {
        collection,
        conditions: [],
      };

      if (Array.isArray(query.condition)) {
        query.condition.forEach((condition: any) => {
          const type = condition.type;
          switch (type) {
            case "startAt":
            case "startAfter":
            case "endAt":
            case "endBefore":
              data.queries![id].conditions!.push({
                [condition.type]: condition.value,
              });
              break;
            case "limit":
            case "limitToLast":
            case "offset":
              data.queries![id].conditions!.push({
                [condition.type]: parseInt(condition.value),
              });
              break;
            case "orderBy":
              data.queries![id].conditions!.push({
                [condition.type]: [condition.value, condition.direction],
              });
              break;
            case "where": {
              data.queries![id].conditions!.push({
                [condition.type]: [
                  condition.field,
                  condition.op,
                  condition.value,
                ],
              });
            }
          }
        });
      }
    }
  }
  
  await createBundle(id, data);
  return redirect(`/`);
};

const randomId = () => Math.random().toString(36).substring(2, 15);
const randomArray = (len: number) => Array.from({ length: len }, randomId);

export default function Create() {
  const action = useActionData();
  
  const [queries, setQueries] = useState<string[]>(
    action?.form.query ? randomArray(action?.form.query.length) : []
  );
  const [params, setParams] = useState<string[]>(
    action?.form.params ? randomArray(action?.form.params.length) : []
  );

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold leading-tight tracking-tight">
        Create a new bundle
      </h2>
      <p className="mt-2">
        The below form allows you to create a new bundle with all available
        options in your Firebase Console.
      </p>
      <form method="post" action="/create">
        <Label
          label="Bundle ID *"
          description="A required type for the bundle name. This is used to accept incoming HTTP requests from the callable function, e,g `/bundles/<bundleName>`."
        >
          <Input name="id" type="text" required placeholder="e.g. users" defaultValue={action?.form.id} error={action?.errors.id} />
        </Label>
        <Label
          label="Client Cache"
          description="An optional value. Specifies how long to keep the bundle in the client's cache, in seconds. If not defined, client-side cache is disabled."
        >
          <Input name="clientCache" type="number" placeholder="e.g. 300" defaultValue={action?.form.clientCache} error={action?.errors.clientCache} />
        </Label>
        <Label
          label="Server Cache"
          description="An optional value. Only use in combination with Firebase Hosting. Specifies how long to keep the bundle in Firebase Hosting's CDN cache, in seconds."
        >
          <Input name="serverCache" type="number" placeholder="e.g. 300" defaultValue={action?.form.serverCache} error={action?.errors.serverCache} />
        </Label>
        <Label
          label="File Cache"
          description="An optional value. Specifies how long (in seconds) to keep the bundle in a Cloud Storage bucket, in seconds. If not defined, Cloud Storage bucket is not accessed."
        >
          <Input name="fileCache" type="number" placeholder="e.g. 300" defaultValue={action?.form.fileCache} error={action?.errors.fileCache} />
        </Label>
        <Label
          label="Documents"
          description="A comma separated list of document paths. If specified, only these documents will be included in the bundle."
        >
          <Input
            name="docs"
            type="string"
            placeholder="e.g. products/coffee-club,products/french-press"
            defaultValue={action?.form.docs}
            error={action?.errors.docs}
          />
        </Label>
        <Label
          label="Params"
          description="Optional params to define. Can be referenced in queries via the `$param` notation and provided via HTTP query params (e.g. ?name=)."
        />
        <button
          type="button"
          onClick={() => setParams(($) => [...$, randomId()])}
          className="rounded border px-3 py-2 text-sm"
        >
          Add Param +
        </button>
        {params.map((id, i) => {
          return (
            <Param
              id={id}
              index={i}
              key={id}
              defaults={action?.form.params?.[i]}
              onDelete={(id) => {
                setParams(($) => $.filter((_) => _ !== id));
              }}
            />
          );
        })}
        <Label
          label="Queries"
          description="A list of queries to include in the bundle. Each query has its own unique ID a client can use via the `namedQuery` API."
        />
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setQueries(($) => [...$, randomId()])}
            className="rounded border px-3 py-2 text-sm"
          >
            Add Query +
          </button>
        </div>
        <div>
          {queries.map((id, i) => {
            return (
              <Queries
                id={id}
                index={i}
                key={id}
                defaults={action?.form.query?.[i]}
                onDelete={(id) => {
                  setQueries(($) => $.filter((_) => _ !== id));
                }}
              />
            );
          })}
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit">Create Bundle &rarr;</Button>
        </div>
      </form>
    </div>
  );
}

function Param(props: {
  id: string;
  index: number;
  onDelete: (id: string) => void;
  defaults?: any;
}) {
  return (
    <div className="grid grid-cols-[1fr,1fr,1fr,auto] gap-3 items-center">
      <Label label="Name">
        <input name={`params[${props.index}][name]`} type="string" required defaultValue={props.defaults?.name} />
      </Label>
      <Label label="Required">
        <select name={`params[${props.index}][required]`} defaultValue={props.defaults?.required}>
          <option value="true">Required</option>
          <option value="false">Not Required</option>
        </select>
      </Label>
      <Label label="Type">
        <select name={`params[${props.index}][type]`} defaultValue={props.defaults?.type}>
          <option value="string">string</option>
          <option value="integer">integer</option>
          <option value="float">float</option>
          <option value="boolean">boolean</option>
          <option value="integer-array">integer-array</option>
          <option value="float-array">float-array</option>
          <option value="string-array">string-array</option>
        </select>
      </Label>
      <button
        className="mt-12 w-6 h-6 flex items-center justify-center hover:opacity-50"
        onClick={() => props.onDelete(props.id)}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function Queries(props: {
  id: string;
  index: number;
  onDelete: (id: string) => void;
  defaults?: any;
}) {
  const [conditions, setConditions] = useState<string[]>(
    props.defaults?.condition ? randomArray(props.defaults.condition.length) : []
  );

  return (
    <div className="border px-3 mb-3">
      <Label
        label="Query ID"
        description="The unique query ID to be added to the bundle."
        action={
          <button
            className="w-6 h-6 hover:opacity-50"
            onClick={() => props.onDelete(props.id)}
          >
            <TrashIcon />
          </button>
        }
      >
        <Input name={`query[${props.index}][id]`} type="string" required defaultValue={props.defaults?.id} />
      </Label>
      <Label label="The collection path to perform the query on.">
        <Input
          name={`query[${props.index}][collection]`}
          type="string"
          required
          defaultValue={props.defaults?.collection}
        />
      </Label>
      <div className="my-3">
        <button
          type="button"
          onClick={() => setConditions(($) => [...$, randomId()])}
          className="rounded border px-3 py-2 text-sm"
        >
          Add Condition +
        </button>
      </div>
      {conditions.map((id, i) => {
        return (
          <Condition
            id={id}
            index={i}
            queryIndex={props.index}
            defaults={props.defaults?.condition?.[i]}
            key={id}
            onDelete={(id) => {
              setConditions(($) => $.filter((_) => _ !== id));
            }}
          />
        );
      })}
    </div>
  );
}

function Condition(props: {
  id: string;
  index: number;
  queryIndex: number;
  onDelete: (id: string) => void;
  defaults?: any;
}) {
  const [type, setType] = useState(props.defaults?.type ?? "where");
  const [op, setOp] = useState(props.defaults?.op ?? "<");

  const stringInput = () => (
    <Input
      type="text"
      name={`query[${props.queryIndex}][condition][${props.index}][value]`}
      defaultValue={props.defaults?.value}
    />
  );
  const numberInput = () => (
    <Input
      type="number"
      name={`query[${props.queryIndex}][condition][${props.index}][value]`}
      defaultValue={props.defaults?.value}
    />
  );
  const orderInput = () => (
    <div className="grid grid-cols-2 gap-3">
      <Input
        type="string"
        name={`query[${props.queryIndex}][condition][${props.index}][value]`}
        defaultValue={props.defaults?.value}
      />
      <select
        name={`query[${props.queryIndex}][condition][${props.index}][direction]`}
        defaultValue={props.defaults?.direction}
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </div>
  );
  const whereInput = () => (
    <div className="grid grid-cols-3 gap-3">
      <Input
        type="string"
        name={`query[${props.queryIndex}][condition][${props.index}][field]`}
        defaultValue={props.defaults?.field}
      />
      <select
        name={`query[${props.queryIndex}][condition][${props.index}][op]`}
        defaultValue={props.defaults?.op}
        onChange={(e) => {
          setOp(e.target.value);
        }}
      >
        <option value="<">{"<"}</option>
        <option value="<=">{"<="}</option>
        <option value="==">{"=="}</option>
        <option value="!=">{"!="}</option>
        <option value=">=">{">="}</option>
        <option value=">">{">"}</option>
        <option value="array-contains">{"array-contains"}</option>
        <option value="in">{"in"}</option>
        <option value="not-in">{"not-in"}</option>
        <option value="array-contains-any">{"array-contains-any"}</option>
      </select>
      <Input
        type="string"
        name={`query[${props.queryIndex}][condition][${props.index}][value]`}
        defaultValue={props.defaults?.value}
      />
    </div>
  );

  const value = () => {
    switch (type) {
      case "limit":
      case "limitToLast":
      case "offset":
        return numberInput();
      case "orderBy":
        return orderInput();
      case "where":
        return whereInput();
      default:
        return stringInput();
    }
  };

  const description = () => {
    if (type === 'where') {
      switch (op) {
        case "in":
        case "not-in":
        case "array-contains-any":
          return "Use a command delimited string to specify multiple values. For example: 'value1,value2,value3'";
        default:
          return "";
      }
    }
  }

  return (
    <div className="border p-3 mb-3">
      <Label
        label="Condition Type"
        action={
          <button className="w-6 h-6" onClick={() => props.onDelete(props.id)}>
            <TrashIcon />
          </button>
        }
      >
        <select
          name={`query[${props.queryIndex}][condition][${props.index}][type]`}
          defaultValue={props.defaults?.type}
          onChange={(e) => {
            setType(e.target.value);
          }}
        >
          <option value="where">Where</option>
          <option value="orderBy">Order By</option>
          <option value="limit">Limit</option>
          <option value="limitToLast">Limit To Last</option>
          <option value="offset">Offset</option>
          <option value="startAt">Start At</option>
          <option value="startAfter">Start After</option>
          <option value="endAt">End At</option>
          <option value="endBefore">End Before</option>
        </select>
      </Label>

      <Label label="Condition Value" description={description()}>
        {value()}
      </Label>
    </div>
  );
}