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

import type { MetaFunction, LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import tailwind from "./tailwind.css";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Firestore Bundle Builder - Admin Dashboard",
  viewport: "width=device-width,initial-scale=1",
});


export const links: LinksFunction = () => [{ rel: "stylesheet", href: tailwind }];

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <header className="bg-slate-800">
          <div className="max-w-5xl mx-auto py-6 text-white flex items-center">
            <h1 className="flex-grow text-2xl font-bold leading-tight tracking-tight">
              <a href="/">Firestore Bundle Builder</a>
            </h1>
            <ul className="flex items-center gap-4">
              <li>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  href="https://firebase.google.com/products/extensions/firestore-bundle-builder"
                >
                  View Extension
                </a>
              </li>
              <li>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  href="https://firebase.google.com/docs/extensions"
                >
                  Firebase Docs
                </a>
              </li>
            </ul>
          </div>
        </header>
        <main className="my-6">
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}