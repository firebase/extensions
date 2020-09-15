"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
const subjHandlebars = handlebars_1.create();
const htmlHandlebars = handlebars_1.create();
const textHandlebars = handlebars_1.create();
const ampHandlebars = handlebars_1.create();
const firebase_functions_1 = require("firebase-functions");
class Templates {
    constructor(collection) {
        this.collection = collection;
        this.collection.onSnapshot(this.updateTemplates.bind(this));
        this.templateMap = {};
        this.ready = false;
        this.waits = [];
    }
    waitUntilReady() {
        if (this.ready) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.waits.push(resolve);
        });
    }
    updateTemplates(snap) {
        const all = snap.docs.map((doc) => Object.assign({ name: doc.id }, doc.data()));
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
            console.log(`registered partial '${p.name}'`);
        });
        templates.forEach((t) => {
            const tgroup = {};
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
            this.templateMap[t.name] = tgroup;
            firebase_functions_1.logger.log(`loaded template '${t.name}'`);
        });
        this.ready = true;
        this.waits.forEach((wait) => wait());
    }
    async render(name, data) {
        await this.waitUntilReady();
        if (!this.templateMap[name]) {
            return Promise.reject(new Error(`tried to render non-existent template '${name}'`));
        }
        const t = this.templateMap[name];
        return {
            subject: t.subject ? t.subject(data) : null,
            html: t.html ? t.html(data) : null,
            text: t.text ? t.text(data) : null,
            amp: t.amp ? t.amp(data) : null,
        };
    }
}
exports.default = Templates;
