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

import { create } from "handlebars";

import { TemplateGroup, TemplateData, Attachment } from "./types";

import {
  registeredPartial,
  templateLoaded,
  noPartialAttachmentSupport,
} from "./logs";
import { type } from "os";

const subjHandlebars = create();
const htmlHandlebars = create();
const textHandlebars = create();
const ampHandlebars = create();
const attachmentsHandlebars = create();

export default class Templates {
  collection: FirebaseFirestore.CollectionReference;
  templateMap: { [name: string]: TemplateGroup };

  private ready: boolean;
  private waits: (() => void)[];

  constructor(param: { collection?: FirebaseFirestore.CollectionReference, template?: TemplateData }) {
    if (param.template) {
      this.updateTemplates([param.template]);
      this.templateMap = {};
      this.ready = false;
      this.waits = [];
    } else if (param.collection) {
      this.collection = param.collection;
      this.collection.onSnapshot(this.updateTemplates.bind(this));
      this.templateMap = {};
      this.ready = false;
      this.waits = [];
    }

  }

  private waitUntilReady(): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.waits.push(resolve);
    });
  }

  private updateTemplates(snap: FirebaseFirestore.QuerySnapshot | TemplateData[]) {
    let all: TemplateData[];
    if ("docs" in snap) {
      all = snap.docs.map((doc) =>
        Object.assign({ name: doc.id }, doc.data())
      );
    } else {
      all = snap;
    }


    const partials = all.filter((t) => t.partial);
    const templates = all.filter((t) => !t.partial);

    partials.forEach((p) => {
      if (p.subject) {
        subjHandlebars.registerPartial(p.name, p.subject);
      }
      if (p.html) {
        htmlHandlebars.registerPartial(p.name, p.html);
      }
      if (p.text) {
        textHandlebars.registerPartial(p.name, p.text);
      }
      if (p.amp) {
        ampHandlebars.registerPartial(p.name, p.amp);
      }
      if (p.attachments) {
        noPartialAttachmentSupport();
      }

      registeredPartial(p.name);
    });

    templates.forEach((t) => {
      const tgroup: TemplateGroup = {};
      if (t.subject) {
        tgroup.subject = subjHandlebars.compile(t.subject, { noEscape: true });
      }
      if (t.html) {
        tgroup.html = htmlHandlebars.compile(t.html);
      }
      if (t.text) {
        tgroup.text = textHandlebars.compile(t.text, { noEscape: true });
      }
      if (t.amp) {
        tgroup.amp = ampHandlebars.compile(t.amp);
      }
      if (t.attachments) {
        tgroup.attachments = attachmentsHandlebars.compile(
          JSON.stringify(t.attachments),
          { strict: true }
        );
      }

      this.templateMap[t.name] = tgroup;

      templateLoaded(t.name);
    });
    this.ready = true;
    this.waits.forEach((wait) => wait());
  }

  async render(name: string, data: any): Promise<{
    subject: string | null;
    html: string | null;
    text: string | null;
    amp: string | null;
    attachments: Attachment[] | null;
  }> {
    await this.waitUntilReady();
    if (!this.templateMap[name]) {
      return Promise.reject(
        new Error(`tried to render non-existent template '${name}'`)
      );
    }

    const t = this.templateMap[name];
    let attachments;

    if (t.attachments) {
      const interpolatedAttachments = t.attachments(data);
      attachments = JSON.parse(interpolatedAttachments);
    }

    return {
      subject: t.subject ? t.subject(data) : null,
      html: t.html ? t.html(data) : null,
      text: t.text ? t.text(data) : null,
      amp: t.amp ? t.amp(data) : null,
      attachments: attachments || null,
    };
  }
}
