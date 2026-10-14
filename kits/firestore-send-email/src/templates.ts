/*
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

import type {
  CollectionReference,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { create } from "handlebars";
import {
  checkingMissingTemplate,
  foundMissingTemplate,
  noPartialAttachmentSupport,
  registeredPartial,
  templatesLoaded,
} from "./logs";
import type { Attachment, TemplateData, TemplateGroup } from "./types";

const subjHandlebars = create();
const htmlHandlebars = create();
const textHandlebars = create();
const ampHandlebars = create();
const attachmentsHandlebars = create();

export class Templates {
  collection: CollectionReference;
  templateMap: Record<string, TemplateGroup> = {};
  private ready = false;
  private waits: Array<() => void> = [];

  constructor(collection: CollectionReference) {
    this.collection = collection;
    this.collection.onSnapshot(this.updateTemplates.bind(this));
  }

  private waitUntilReady(): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waits.push(resolve);
    });
  }

  private updateTemplates(snap: QuerySnapshot) {
    const all: TemplateData[] = snap.docs.map((doc) =>
      Object.assign({ name: doc.id }, doc.data())
    );
    const partials = all.filter((t) => t.partial);
    const templates = all.filter((t) => !t.partial);

    partials.forEach((partial) => {
      if (partial.subject)
        subjHandlebars.registerPartial(partial.name, partial.subject);
      if (partial.html)
        htmlHandlebars.registerPartial(partial.name, partial.html);
      if (partial.text)
        textHandlebars.registerPartial(partial.name, partial.text);
      if (partial.amp) ampHandlebars.registerPartial(partial.name, partial.amp);
      if (partial.attachments) noPartialAttachmentSupport();
      registeredPartial(partial.name);
    });

    const loadedTemplates = templates.map((template) => {
      const group: TemplateGroup = {};
      if (template.subject) {
        group.subject = subjHandlebars.compile(template.subject, {
          noEscape: true,
        });
      }
      if (template.html) {
        group.html = htmlHandlebars.compile(template.html);
      }
      if (template.text) {
        group.text = textHandlebars.compile(template.text, { noEscape: true });
      }
      if (template.amp) {
        group.amp = ampHandlebars.compile(template.amp);
      }
      if (template.attachments) {
        group.attachments = attachmentsHandlebars.compile(
          JSON.stringify(template.attachments),
          { strict: true }
        );
      }
      this.templateMap[template.name] = group;
      return template.name;
    });

    templatesLoaded(loadedTemplates);
    this.ready = true;
    this.waits.forEach((wait) => {
      wait();
    });
    this.waits = [];
  }

  checkTemplateExists(name: string) {
    return this.collection
      .where("name", "==", name)
      .get()
      .then((t) => !t.empty);
  }

  async render(
    name: string,
    data: Record<string, unknown>
  ): Promise<{
    subject: string | null;
    html: string | null;
    text: string | null;
    amp: string | null;
    attachments: Attachment[] | null;
  }> {
    await this.waitUntilReady();
    if (!this.templateMap[name]) {
      checkingMissingTemplate(name);
      const templateExists = await this.checkTemplateExists(name);
      if (!templateExists) {
        throw new Error(`Tried to render non-existent template '${name}'`);
      }
      foundMissingTemplate(name);
    }

    const template = this.templateMap[name];
    let attachments: Attachment[] | undefined;
    if (template.attachments) {
      attachments = JSON.parse(template.attachments(data));
    }

    return {
      subject: template.subject ? template.subject(data) : null,
      html: template.html ? template.html(data) : null,
      text: template.text ? template.text(data) : null,
      amp: template.amp ? template.amp(data) : null,
      attachments: attachments || null,
    };
  }
}
