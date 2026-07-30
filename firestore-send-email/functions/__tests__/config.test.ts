/**
 * Copyright 2026 Google LLC
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

import * as functionsTestInit from "firebase-functions-test";
import mockedEnv from "mocked-env";
import { AuthenticatonType, Config } from "../src/types";

//@ts-ignore
const { config } = global;

let restoreEnv;

functionsTestInit();

const environment = {
  LOCATION: "us-central1",
  DATABASE: "fake-database",
  DATABASE_REGION: "us-central1",
  TEMPLATES_COLLECTION: "templates",
  MAIL_COLLECTION: "mail",
  SMTP_CONNECTION_URI:
    "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
  SMTP_PASSWORD: "secret-password",
  DEFAULT_FROM: "fakeemail@gmail.com",
  DEFAULT_REPLY_TO: "fakeemail@gmail.com",
  USERS_COLLECTION: "users",
  TESTING: "true",
  TTL_EXPIRE_TYPE: "day",
  TTL_EXPIRE_VALUE: "1",
  TLS_OPTIONS: "{}",
  AUTH_TYPE: AuthenticatonType.OAuth2,
  CLIENT_ID: "fake-client-id",
  CLIENT_SECRET: "fake-client",
  REFRESH_TOKEN: "test-refresh-token",
  ACCESS_TOKEN: "test-access",
  USER: "test@test.com",
  OAUTH_PORT: "465",
};

describe("extensions config", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(environment);
  });
  afterEach(() => restoreEnv());

  test("config loaded from environment variables", () => {
    const testConfig: Config = {
      location: process.env.LOCATION,
      database: process.env.DATABASE,
      databaseRegion: process.env.DATABASE_REGION,
      mailCollection: process.env.MAIL_COLLECTION,
      smtpConnectionUri: process.env.SMTP_CONNECTION_URI,
      smtpPassword: process.env.SMTP_PASSWORD,
      defaultFrom: process.env.DEFAULT_FROM,
      defaultReplyTo: process.env.DEFAULT_REPLY_TO,
      usersCollection: process.env.USERS_COLLECTION,
      templatesCollection: process.env.TEMPLATES_COLLECTION,
      testing: process.env.TESTING === "true",
      TTLExpireType: process.env.TTL_EXPIRE_TYPE,
      TTLExpireValue: parseInt(process.env.TTL_EXPIRE_VALUE),
      tls: process.env.TLS_OPTIONS,
      host: process.env.HOST,
      port: parseInt(process.env.OAUTH_PORT, null),
      secure: process.env.SECURE === "true",
      authenticationType: process.env.AUTH_TYPE as AuthenticatonType,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      user: process.env.USER,
    };
    const functionsConfig = config();
    expect(functionsConfig).toStrictEqual(testConfig);
  });
});
