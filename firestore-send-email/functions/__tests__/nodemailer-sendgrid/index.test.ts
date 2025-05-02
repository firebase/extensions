import * as sgMail from "@sendgrid/mail";
import {
  SendGridTransport,
  SendGridTransportOptions,
  MailSource,
  Address,
  AttachmentEntry,
  IcalEvent,
} from "../../src/nodemailer-sendgrid";

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe("SendGridTransport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("constructor: sets API key when provided", () => {
    new SendGridTransport({ apiKey: "API-KEY-123" });
    expect(sgMail.setApiKey as jest.Mock).toHaveBeenCalledWith("API-KEY-123");
  });

  test("constructor: does not call setApiKey when no apiKey option", () => {
    new SendGridTransport({});
    expect(sgMail.setApiKey as jest.Mock).not.toHaveBeenCalled();
  });

  test("send: callback with error if normalize errors", async () => {
    const transport = new SendGridTransport({ apiKey: "X" });
    const fakeErr = new Error("normalize failed");
    const fakeMail: Partial<MailSource> = {
      normalize: (cb) => cb(fakeErr, {} as any),
    };

    const cb = jest.fn();
    transport.send(fakeMail as MailSource, cb);

    // allow normalize→callback to run
    await new Promise((r) => setImmediate(r));

    expect(cb).toHaveBeenCalledWith(fakeErr);
    expect(sgMail.send as jest.Mock).not.toHaveBeenCalled();
  });

  test("send: basic subject/text/html mapping", async () => {
    const transport = new SendGridTransport();
    const source = { subject: "S", text: "T", html: "<p>H</p>" };
    const fakeMail: any = { normalize: (cb: any) => cb(null, source) };

    (sgMail.send as jest.Mock).mockResolvedValueOnce(["OK", {}]);
    const cb = jest.fn();

    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    expect(sgMail.send).toHaveBeenCalledWith({
      subject: "S",
      text: "T",
      html: "<p>H</p>",
    });
    expect(cb).toHaveBeenCalledWith(null, ["OK", {}]);
  });

  test("send: maps from and replyTo", async () => {
    const transport = new SendGridTransport();
    const addr: Address = { name: "Alice", address: "a@x.com" };
    const source = { from: addr, replyTo: [addr] };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sentMsg = (sgMail.send as jest.Mock).mock.calls[0][0];
    expect(sentMsg.from).toEqual({ name: "Alice", email: "a@x.com" });
    expect(sentMsg.replyTo).toEqual({ name: "Alice", email: "a@x.com" });
    expect(cb).toHaveBeenCalledWith(null, [{}, {}]);
  });

  test("send: maps to, cc, bcc arrays", async () => {
    const transport = new SendGridTransport();
    const a1: Address = { name: "B", address: "b@x" };
    const a2: Address = { name: "C", address: "c@x" };
    const source = { to: [a1], cc: a2, bcc: [a1, a2] };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sent = (sgMail.send as jest.Mock).mock.calls[0][0];
    expect(sent.to).toEqual([{ name: "B", email: "b@x" }]);
    expect(sent.cc).toEqual([{ name: "C", email: "c@x" }]);
    expect(sent.bcc).toEqual([
      { name: "B", email: "b@x" },
      { name: "C", email: "c@x" },
    ]);
  });

  test("send: attachments with inline and normal dispositions", async () => {
    const transport = new SendGridTransport();
    const atchs: AttachmentEntry[] = [
      { content: "foo", filename: "f.txt", contentType: "text/plain" },
      {
        content: "img",
        filename: "i.png",
        contentType: "image/png",
        cid: "cid123",
      },
    ];
    const source = { attachments: atchs };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sentAtt = (sgMail.send as jest.Mock).mock.calls[0][0].attachments;
    expect(sentAtt).toHaveLength(2);
    // first: normal
    expect(sentAtt[0]).toMatchObject({
      content: "foo",
      filename: "f.txt",
      type: "text/plain",
      disposition: "attachment",
    });
    // second: inline
    expect(sentAtt[1]).toMatchObject({
      content: "img",
      filename: "i.png",
      type: "image/png",
      disposition: "inline",
      content_id: "cid123",
    });
  });

  test("send: alternatives → content", async () => {
    const transport = new SendGridTransport();
    const alts = [{ content: "alt", contentType: "text/alt" }];
    const source = { alternatives: alts };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sentContent = (sgMail.send as jest.Mock).mock.calls[0][0].content;
    expect(sentContent).toEqual([{ content: "alt", type: "text/alt" }]);
  });

  test("send: icalEvent as attachment", async () => {
    const transport = new SendGridTransport();
    const ev: IcalEvent = { content: "ics", filename: "evt.ics" };
    const source = { icalEvent: ev };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sentAtt = (sgMail.send as jest.Mock).mock.calls[0][0].attachments![0];
    expect(sentAtt).toMatchObject({
      content: "ics",
      filename: "evt.ics",
      type: "application/ics",
      disposition: "attachment",
    });
  });

  test("send: watchHtml → content", async () => {
    const transport = new SendGridTransport();
    const source = { watchHtml: "<watch>" };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const content = (sgMail.send as jest.Mock).mock.calls[0][0].content;
    expect(content).toEqual([{ content: "<watch>", type: "text/watch-html" }]);
  });

  test("send: normalizedHeaders & messageId → headers", async () => {
    const transport = new SendGridTransport();
    const source = {
      normalizedHeaders: { "X-Custom": "val" },
      messageId: "msg-123",
    };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const headers = (sgMail.send as jest.Mock).mock.calls[0][0].headers;
    expect(headers).toMatchObject({
      "X-Custom": "val",
      "message-id": "msg-123",
    });
  });

  test("send: merges text/html into content array when alternatives present", async () => {
    const transport = new SendGridTransport();
    const source = {
      text: "TXT",
      html: "<H>",
      alternatives: [{ content: "alt1", contentType: "type1" }],
    };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const content = (sgMail.send as jest.Mock).mock.calls[0][0].content;
    expect(content).toEqual([
      { type: "text/html", content: "<H>" },
      { type: "text/plain", content: "TXT" },
      { type: "type1", content: "alt1" },
    ]);
  });

  test("send: callback with error if sgMail.send rejects", async () => {
    const transport = new SendGridTransport();
    const source = { subject: "Hi" };
    const fakeMail: any = { normalize: (cb) => cb(null, source) };
    const sendErr = new Error("send failed");
    (sgMail.send as jest.Mock).mockRejectedValueOnce(sendErr);

    const cb = jest.fn();
    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    expect(cb).toHaveBeenCalledWith(sendErr);
  });

  test("send: forwards categories array", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const fakeMail: any = {
      normalize: (cb: any) =>
        cb(null, {
          from: { address: "a@x.com" },
          to: [{ address: "b@x.com" }],
          subject: "Category test",
          categories: ["alpha", "beta", "gamma"],
        }),
    };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);
    const cb = jest.fn();

    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sent = (sgMail.send as jest.Mock).mock.calls[0][0];
    expect(sent.categories).toEqual(["alpha", "beta", "gamma"]);
  });

  test("send: forwards templateId & dynamicTemplateData", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const fakeMail: any = {
      normalize: (cb: any) =>
        cb(null, {
          from: { address: "from@ex.com" },
          to: [{ address: "to@ex.com" }],
          subject: "Template test",
          templateId: "d-1234567890abcdef",
          dynamicTemplateData: { name: "Jacob", count: 42 },
        }),
    };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);
    const cb = jest.fn();

    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sent = (sgMail.send as jest.Mock).mock.calls[0][0];
    expect(sent.templateId).toBe("d-1234567890abcdef");
    expect(sent.dynamicTemplateData).toMatchObject({
      name: "Jacob",
      count: 42,
    });
  });

  test("send: forwards mailSettings object", async () => {
    const transport = new SendGridTransport({ apiKey: "KEY" });
    const fakeMail: any = {
      normalize: (cb: any) =>
        cb(null, {
          from: { address: "a@x.com" },
          to: [{ address: "b@x.com" }],
          subject: "MailSettings test",
          mailSettings: {
            sandboxMode: { enable: true },
            personalization: { enable: false },
          },
        }),
    };
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{}, {}]);
    const cb = jest.fn();

    transport.send(fakeMail, cb);
    await new Promise((r) => setImmediate(r));

    const sent = (sgMail.send as jest.Mock).mock.calls[0][0];
    expect(sent.mailSettings).toMatchObject({
      sandboxMode: { enable: true },
      personalization: { enable: false },
    });
  });
});
