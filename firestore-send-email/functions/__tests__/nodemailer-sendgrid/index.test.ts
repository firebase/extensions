// __tests__/SendGridTransport.test.ts

import * as sgMail from "@sendgrid/mail";
import { SendGridTransport } from "../../src/nodemailer-sendgrid";

// 1) Mock out setApiKey/send before importing our transport
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe("SendGridTransport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sets API key when provided", () => {
    new SendGridTransport({ apiKey: "test-key" });
    expect(sgMail.setApiKey).toHaveBeenCalledWith("test-key");
  });

  test("normalizes the mail and calls sgMail.send + callback", async () => {
    const transport = new SendGridTransport({ apiKey: "ignored" });

    // 2) Prepare a fake MailSource that calls back with our `source`
    const source = {
      subject: "Hello",
      text: "World",
      from: { name: "Alice", address: "alice@example.com" },
      to: [{ name: "Bob", address: "bob@example.com" }],
    };
    const fakeMail: any = {
      normalize: jest.fn((cb: any) => cb(null, source)),
    };

    // 3) Stub sgMail.send to resolve with a fake response
    (sgMail.send as jest.Mock).mockResolvedValueOnce(["SENT", {}]);

    const callback = jest.fn();

    // 4) Call send() and wait for the microtask queue to flush
    transport.send(fakeMail, callback);
    await new Promise((resolve) => setImmediate(resolve));

    // 5) Assertions
    expect(fakeMail.normalize).toHaveBeenCalled();
    expect(sgMail.send).toHaveBeenCalledWith({
      subject: "Hello",
      text: "World",
      from: { name: "Alice", email: "alice@example.com" },
      to: [{ name: "Bob", email: "bob@example.com" }],
    });
    expect(callback).toHaveBeenCalledWith(null, ["SENT", {}]);
  });
});
