"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    stripeSecretKey: process.env.STRIPE_API_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    daysUntilDue: Number(process.env.DAYS_UNTIL_DUE_DEFAULT),
    invoicesCollectionPath: process.env.INVOICES_COLLECTION,
};
//# sourceMappingURL=config.js.map