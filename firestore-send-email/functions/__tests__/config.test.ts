import * as functionsTestInit from "firebase-functions-test";
import mockedEnv from "mocked-env";
import { Config } from "../src/types";

const { config } = global;

let restoreEnv;

functionsTestInit();

const environment = {
  LOCATION: "us-central1",
  TEMPLATES_COLLECTION: "templates",
  MAIL_COLLECTION: "mail",
  SMTP_CONNECTION_URI:
    "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
  SMTP_PASSWORD: "secret-password",
  DEFAULT_FROM: "fakeemail@gmail.com",
  DEFAULT_REPLY_TO: "fakeemail@gmail.com",
  USERS_COLLECTION: "users",
  TESTING: "true",
};

describe("extensions config", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(environment);
  });
  afterEach(() => restoreEnv());

  test("config loaded from environment variables", () => {
    const testConfig: Config = {
      location: process.env.LOCATION,
      mailCollection: process.env.MAIL_COLLECTION,
      smtpConnectionUri: process.env.SMTP_CONNECTION_URI,
      smtpPassword: process.env.SMTP_PASSWORD,
      defaultFrom: process.env.DEFAULT_FROM,
      defaultReplyTo: process.env.DEFAULT_REPLY_TO,
      usersCollection: process.env.USERS_COLLECTION,
      templatesCollection: process.env.TEMPLATES_COLLECTION,
      testing: process.env.TESTING === "true",
    };
    const functionsConfig = config();
    expect(functionsConfig).toStrictEqual(testConfig);
  });
});
