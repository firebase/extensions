import * as functionsTestInit from "firebase-functions-test";
import mockedEnv from "mocked-env";

const { config } = global;

let restoreEnv;

functionsTestInit();

const environment = {
  LOCATION: "us-central1",
  TEMPLATES_COLLECTION: "templates",
  MAIL_COLLECTION: "mail",
  SMTP_CONNECTION_URI:
    "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
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
    const testConfig = {
      location: environment.LOCATION,
      mailCollection: environment.MAIL_COLLECTION,
      smtpConnectionUri: environment.SMTP_CONNECTION_URI,
      defaultFrom: environment.DEFAULT_FROM,
      defaultReplyTo: environment.DEFAULT_REPLY_TO,
      usersCollection: environment.USERS_COLLECTION,
      templatesCollection: environment.TEMPLATES_COLLECTION,
      testing: environment.TESTING === "true",
    };
    const functionsConfig = config();

    expect(functionsConfig).toStrictEqual(testConfig);
  });
});
