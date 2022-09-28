"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
};
