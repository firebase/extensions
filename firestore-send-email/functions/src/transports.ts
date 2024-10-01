import { Transport } from "nodemailer";
import * as sgMail from '@sendgrid/mail';

interface Mail {
    normalize(callback: (err: Error | null, source?: any) => void): void;
}

export interface SendGridTransportOptions {
    apiKey?: string;
}

class SendGridTransport implements Transport<SendGridTransportOptions> {
    options: SendGridTransportOptions;
    name: string;
    version: string;

    constructor(options: SendGridTransportOptions) {
        this.options = options || {};
        this.name = 'SendGrid';
        this.version = undefined;
        if (options.apiKey) {
            sgMail.setApiKey(options.apiKey);
        }
    }

    send(mail: Mail, callback: (err: Error | null, info: SendGridTransportOptions) => void) {
        mail.normalize((err, source) => {
            if (err) {
                return callback(err, this.options);
            }

            // Format the message
            let msg: any = {};
            Object.keys(source || {}).forEach(key => {
                switch (key) {
                    case 'subject':
                    case 'text':
                    case 'html':
                        msg[key] = source[key];
                        break;
                    case 'from':
                    case 'replyTo':
                        // Always convert the source to an array of similar objects:
                        // 1. If it's an object, wrap it in an array
                        // 2. If it's already an array, keep it as is
                        // 3. If it's null or undefined, make it an empty array
                        // Then, take the first item from the array
                        msg[key] = []
                            .concat(source[key] || [])
                            .map((entry: any) => ({
                                name: entry.name,
                                email: entry.address
                            }))
                            .shift();
                        break;
                    case 'to':
                    case 'cc':
                    case 'bcc':
                        // Same as above comment, but keep the array
                        msg[key] = [].concat(source[key] || []).map((entry: any) => ({
                            name: entry.name,
                            email: entry.address
                        }));
                        break;
                    case 'attachments':
                        {
                            // Map over the source attachments array and transform each entry
                            let attachments = source.attachments.map((entry: any) => {
                                // Create an attachment object with content, filename, type, and default to 'attachment' disposition
                                let attachment: any = {
                                    content: entry.content,
                                    filename: entry.filename,
                                    type: entry.contentType,
                                    disposition: 'attachment' // default disposition for regular attachments
                                };

                                // If the attachment has a content ID (cid), add it and set the disposition to 'inline'
                                if (entry.cid) {
                                    // add property
                                    attachment.content_id = entry.cid; // Adding content ID for inline attachments
                                    attachment.disposition = 'inline'; // Inline attachments are typically images displayed in the email body
                                }

                                // Return the transformed attachment object
                                return attachment;
                            });

                            msg.attachments = [].concat(msg.attachments || []).concat(attachments);
                        }
                        break;
                    case 'alternatives':
                        {
                            let alternatives = source.alternatives.map((entry: any) => {
                                let alternative = {
                                    content: entry.content,
                                    type: entry.contentType
                                };
                                return alternative;
                            });

                            msg.content = [].concat(msg.content || []).concat(alternatives);
                        }
                        break;
                    case 'icalEvent':
                        {
                            let attachment = {
                                content: source.icalEvent.content,
                                filename: source.icalEvent.filename || 'invite.ics',
                                type: 'application/ics',
                                disposition: 'attachment'
                            };
                            msg.attachments = [].concat(msg.attachments || []).concat(attachment);
                        }
                        break;
                    case 'watchHtml':
                        {
                            let alternative = {
                                content: source.watchHtml,
                                type: 'text/watch-html'
                            };
                            msg.content = [].concat(msg.content || []).concat(alternative);
                        }
                        break;
                    case 'normalizedHeaders':
                        msg.headers = msg.headers || {};
                        Object.keys(source.normalizedHeaders || {}).forEach(header => {
                            msg.headers[header] = source.normalizedHeaders[header];
                        });
                        break;
                    case 'messageId':
                        msg.headers = msg.headers || {};
                        msg.headers['message-id'] = source.messageId;
                        break;
                    default:
                        msg[key] = source[key];
                }
            });

            if (msg.content && msg.content.length) {
                if (msg.text) {
                    msg.content.unshift({ type: 'text/plain', content: msg.text });
                    delete msg.text;
                }
                if (msg.html) {
                    msg.content.unshift({ type: 'text/html', content: msg.html });
                    delete msg.html;
                }
            }

            sgMail.send(msg, null, (err) => { callback(err, this.options); });
        });
    }
}

export default {
    sendGrid: (options: SendGridTransportOptions) => new SendGridTransport(options)
}
