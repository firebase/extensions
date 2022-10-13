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

import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AnchorButton } from "~/components/Button";

import { getBundles } from "~/firebase.server";
import type { Bundle } from "~/types";

export const loader: LoaderFunction = async () => {
  return json({
    bundles: await getBundles(),
    projectId: process.env.PROJECT_ID,
    bundlesCollectionPath: process.env.BUNDLESPEC_COLLECTION || 'bundles',
  });
};

type LoaderData = {
  bundles: Bundle[];
  projectId: string;
  bundlesCollectionPath: string;
};

export default function Index() {
  const { bundles, projectId, bundlesCollectionPath } = useLoaderData<LoaderData>();
  
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-end p-3 mb-2">
        <AnchorButton href="/create">Create Bundle &rarr;</AnchorButton>
      </div>
      <table className="w-full table-auto border border-spacing-0.5">
        <thead>
          <tr className="text-left [&>th]:p-4 bg-slate-100">
            <th>Bundle ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bundles.length === 0 && (
            <tr className="border-t [&>td]:p-3 [&>.code]:font-mono text-center">
              <td colSpan={2}>No bundles created</td>
            </tr>
          )}
          {bundles.map((bundle) => (
            <tr
              key={bundle.id}
              className="border-t [&>td]:p-3 [&>.code]:font-mono"
            >
              <td className="code">{bundle.id}</td>
              <td>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://console.firebase.google.com/project/${projectId}/firestore/data/~2F${bundlesCollectionPath}~2F${bundle.id}`}
                >
                  Manage &rarr;
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}