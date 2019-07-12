"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const node_fetch_1 = require("node-fetch");
const config_1 = require("./config");
const logs = require("./logs");
logs.init();
exports.slackMessenger = functions.handler.pubsub.topic.onPublish((message) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const { text } = message.json;
        if (!text) {
            console.warn("PubSub message does not contain a `text` field");
            return;
        }
        logs.messageSending(config_1.default.slackWebhookUrl);
        yield node_fetch_1.default(config_1.default.slackWebhookUrl, {
            method: "POST",
            body: JSON.stringify({ text }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        logs.messageSent(config_1.default.slackWebhookUrl);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
