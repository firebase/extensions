/**
 * Copyright 2019 Google LLC
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

import { compile } from "handlebars";

interface TemplateGroup {
  body?: HandlebarsTemplateDelegate;
  mediaUrl?: HandlebarsTemplateDelegate;
}

export default class Templates {
  collection: FirebaseFirestore.CollectionReference;
  templateMap: { [name: string]: TemplateGroup };
  private ready: boolean;
  private waits: (() => void)[];

  constructor(collection: FirebaseFirestore.CollectionReference) {
    this.collection = collection;
    this.collection.onSnapshot(this.updateTemplates.bind(this));
    this.templateMap = {};
    this.ready = false;
    this.waits = [];
  }

  private waitUntilReady(): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.waits.push(resolve);
    });
  }

  private updateTemplates(snap: FirebaseFirestore.QuerySnapshot) {
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const templates: TemplateGroup = {};
      if (data.body) {
        templates.body = compile(data.body);
      }
      if (data.mediaUrl) {
        templates.mediaUrl = compile(data.mediaUrl);
      }
      this.templateMap[doc.id] = templates;
      console.log(`loaded template '${doc.id}'`);
    });
    this.ready = true;
    this.waits.forEach((wait) => wait());
  }

  async render(
    name: string,
    data: any
  ): Promise<{
    body: string | null;
    mediaUrl: string | null;
  }> {
    await this.waitUntilReady();
    if (!this.templateMap[name]) {
      return Promise.reject(
        new Error(`tried to render non-existent template '${name}'`)
      );
    }

    const t = this.templateMap[name];
    return {
      body: t.body ? t.body(data) : null,
      mediaUrl: t.mediaUrl ? t.mediaUrl(data) : null,
    };
  }
}
