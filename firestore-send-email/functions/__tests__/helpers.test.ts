import Mail = require("nodemailer/lib/mailer");
const { logger } = require("firebase-functions");

import { setSmtpCredentials, isSendGrid } from "../src/helpers";
import { AuthenticatonType, Config } from "../src/types";

const consoleLogSpy = jest.spyOn(logger, "warn").mockImplementation();

// This is a regex to validate the smtpConnectionUri in extension.yaml
const regex = new RegExp(
  "^(smtp[s]*://(.*?(:[^:@]*)?@)?[^:@]+:[0-9]+(\\?[^ ]*)?)$"
);

describe("setSmtpCredentials function", () => {
  test("return smtpServerDomain credentials with new password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpPassword: "fakepassword",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.pass).toBe(config.smtpPassword);
    expect(credentials.options.secure).toBe(true);

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return smtpServerDomain credentials with old password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("secret-password");
    expect(credentials.options.secure).toBe(true);

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return smtpConnectionUri credentials without any password", () => {
    const config: Config = {
      smtpConnectionUri: "smtps://fakeemail@gmail.com@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("");
    expect(credentials.options.secure).toBe(true);

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return smtpConnectionUri credentials without any password and username", () => {
    const config: Config = {
      smtpConnectionUri: "smtp://smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth).toBe(undefined);
    expect(credentials.options.secure).toBe(false);

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return smtpConnectionUri credentials with query params", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:secret-password@smtp.gmail.com:465?pool=true&service=gmail",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("secret-password");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return valid smtpConnectionUri credentials with valid special chars in password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com@smtp.gmail.com:465?pool=true&service=gmail",
      smtpPassword: "4,h?dhuNTbv9zMrP4&7&7%*3",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("4,h?dhuNTbv9zMrP4&7&7%*3");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("return valid smtpConnectionUri credentials with valid special chars in connectionUri password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:4,hdhuNTbv9zMrP4&7&7%*3@smtp.gmail.com:465?pool=true&service=gmail",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };
    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("4,hdhuNTbv9zMrP4&7&7%*3");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");

    // The regex should match the smtpConnectionUri, it should be valid
    expect(regex.test(config.smtpConnectionUri)).toBe(true);
  });

  test("throw error for invalid smtpConnectionUri", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3@smtp.gmail.com:465?pool=true&service=gmail",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };

    expect(() => setSmtpCredentials(config)).toThrow(Error);
    expect(consoleLogSpy).toBeCalledWith(
      "Invalid URI: please reconfigure with a valid SMTP connection URI"
    );
  });
});

describe("isSendGrid function", () => {
  test("return true for SendGrid SMTP URI", () => {
    const config: Config = {
      smtpConnectionUri: "smtps://apikey@smtp.sendgrid.net:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.ApiKey,
    };

    expect(isSendGrid(config)).toBe(true);
  });

  test("return false for non-SendGrid SMTP URI", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
      authenticationType: AuthenticatonType.UsernamePassword,
    };

    expect(isSendGrid(config)).toBe(false);
  });
});

test("return invalid smtpConnectionUri credentials with invalid separator", () => {
  const config: Config = {
    smtpConnectionUri:
      "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3:smtp.gmail.com:465?pool=true&service=gmail",
    location: "",
    mailCollection: "",
    defaultFrom: "",
    secure: false,
    authenticationType: AuthenticatonType.UsernamePassword,
  };

  expect(regex.test(config.smtpConnectionUri)).toBe(false);
});

test("correctly detects SendGrid SMTP URI", () => {
  const config: Config = {
    smtpConnectionUri: "smtps://apikey@smtp.sendgrid.net:465",
    location: "",
    mailCollection: "",
    defaultFrom: "",
    secure: false,
    authenticationType: AuthenticatonType.ApiKey,
  };
  expect(isSendGrid(config)).toBe(true);

  const invalidConfig: Config = {
    smtpConnectionUri: "smtps://apikey@fake-sendgrid.net:465",
    location: "",
    mailCollection: "",
    defaultFrom: "",
    secure: false,
    authenticationType: AuthenticatonType.UsernamePassword,
  };
  expect(isSendGrid(invalidConfig)).toBe(false);
});

test("correctly uses oAuth credentials when provided", () => {
  const config: Config = {
    smtpConnectionUri:
      "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
    location: "",
    mailCollection: "",
    defaultFrom: "",
    host: "smtp.gmail.com",
    clientId: "fakeClientId",
    clientSecret: "fakeClientSecret",
    refreshToken: "test_refresh_token",
    secure: true,
    authenticationType: AuthenticatonType.OAuth2,
    user: "test@test.com",
  };
  const credentials = setSmtpCredentials(config);
  expect(credentials).toBeInstanceOf(Mail);
  expect(credentials.options.secure).toBe(true);
  expect(credentials.options.host).toBe("smtp.gmail.com");
  expect(credentials.options.auth.type).toBe("OAuth2");
  expect(credentials.options.auth.clientId).toBe("fakeClientId");
  expect(credentials.options.auth.clientSecret).toBe("fakeClientSecret");
  expect(credentials.options.auth.user).toBe("test@test.com");
  expect(credentials.options.auth.refreshToken).toBe("test_refresh_token");
  expect(credentials.options.auth.user).toBe("test@test.com");

  // The regex should match the smtpConnectionUri, it should be valid
  expect(regex.test(config.smtpConnectionUri)).toBe(true);
});
