/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');
// Imports the Google Cloud client library
const { Translate } = require('@google-cloud/translate');

const translate = new Translate({projectId: process.env.PROJECT_ID});

// languages to be translated into
const LANGUAGES = process.env.LANGUAGES.split(',');

// Initializing firebase-admin using auto-populated environment variable.
admin.initializeApp(JSON.parse(process.env.FIREBASE_CONFIG));

// Translate an incoming message.
exports.translate = functions.database.ref('/messages/{languageID}/{messageID}').onWrite(
  async (change, context) => {
    const snapshot = change.after;
    if (snapshot.val().translated) {
      return null;
    }

    for (let i = 0; i < LANGUAGES.length; i++) {
      const targetLanguage = LANGUAGES[i];
      const msg = snapshot.val().message;
      const srcLanguage = context.params.languageID;
      if (targetLanguage !== srcLanguage) {
        const results = await translate.translate(msg, {from: srcLanguage, to: targetLanguage});
        // en: dog; es: perro
        console.log(`${context.params.languageID}: ${msg}; ${targetLanguage}: ${results[0]}`);

        admin.database().ref(`/messages/${targetLanguage}/${snapshot.key}`).set({
          message: results[0],
          translated: true,
        });
      }
    }
  });
