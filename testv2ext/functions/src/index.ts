/*
 * This template contains a HTTP function that responds
 * with a greeting when called
 *
 * Reference PARAMETERS in your functions code with:
 * `process.env.<parameter-name>`
 * Learn more about building extensions in the docs:
 * https://firebase.google.com/docs/extensions/publishers
 */

import {onRequest} from "firebase-functions/v2/https";

export const testv2func = onRequest(
  {cors: true, invoker: "private"},
  (req, res) => {
    console.log("V2 function is working correctly.");
    res.send("Hello from Firebase!");
  }
);