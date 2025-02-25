Use this extension to render and send emails that contain the information from documents added to a specified Cloud Firestore collection.

Adding a document triggers this extension to send an email built from the document's fields. The document's top-level fields specify the email sender and recipients, including `to`, `cc`, and `bcc` options (each supporting UIDs). The document's `message` field specifies the other email elements, like subject line and email body (either plaintext or HTML)

Here's a basic example document write that would trigger this extension:

```js
admin.firestore().collection('mail').add({
  to: 'someone@example.com',
  message: {
    subject: 'Hello from Firebase!',
    html: 'This is an <code>HTML</code> email body.',
  },
})
```

You can also optionally configure this extension to render emails using [Handlebar](https://handlebarsjs.com/) templates. Each template is a document stored in a Cloud Firestore collection.

When you configure this extension, you'll need to supply your **SMTP credentials for mail delivery**. Note that this extension is for use with bulk email service providers, like SendGrid, Mailgun, etc.

#### Firestore-Send-Email: SendGrid Categories

When using SendGrid (`SMTP_CONNECTION_URI` includes `sendgrid.net`), you can assign categories to your emails.

## Example JSON with Categories:
```json
{
  "to": ["example@example.com"],
  "categories": ["Example_Category"],
  "message": {
    "subject": "Test Email with Categories",
    "text": "This is a test email to see if categories work.",
    "html": "<strong>This is a test email to see if categories work.</strong>"
  }
}
```

Add this document to the Firestore mail collection to send categorized emails.

For more details, see the [SendGrid Categories documentation](https://docs.sendgrid.com/ui/sending-email/categories).

#### Setting Up OAuth2 Authentication

This section will help you set up OAuth2 authentication for the extension, using GCP (Gmail) as an example.

##### Step 1: Create OAuth Credentials in Google Cloud Platform

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. In the left sidebar, navigate to **APIs & Services > Credentials**
4. Click Create Credentials and select **OAuth client ID**
5. Set the application type to **Web application**
6. Give your OAuth client a name (e.g., "Firestore Send Email Extension")
7. Under **Authorized redirect URIs**, add the URI where you'll receive the OAuth callback, for example `http://localhost:8080/oauth/callback`.

   **Note**: The redirect URI in your OAuth client settings MUST match exactly the callback URL in your code.

8. Click **Create**.

##### Step 2: Configure OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Choose the appropriate user type:
   - **External**: For applications used by any Google user
   - **Internal**: For applications used only by users in your organization

> **Important Note**: If your OAuth consent screen is in "Testing" status, refresh tokens will expire after 7 days unless the User Type is set to "Internal."

##### Step 3: Generate a Refresh Token

You'll need to create a simple web application to generate a refresh token. In this subsection we illustrate how to do so with Node.js.

Here's how to set it up:

1. Create a new Node.js project:
   ```bash
   mkdir oauth-helper
   cd oauth-helper
   npm init -y
   npm install express google-auth-library dotenv
   ```

2. Create a `.env` file with your credentials:
   ```
   CLIENT_ID=your_client_id
   CLIENT_SECRET=your_client_secret
   ```

3. Create an application with:
   - A root route that redirects users to Google's OAuth consent page
   - A callback route that receives the authorization code and exchanges it for tokens
   (See the sample application included below)

4. **Important**: The redirect URI in your code (e.g., `http://localhost:8080/oauth/callback`) **MUST** match exactly what you configured in the Google Cloud Console OAuth client settings.

5. In your application code:
   - Use the `generateAuthUrl()` method with `access_type: "offline"` and `prompt: "consent"` to request a refresh token
   - Set the appropriate scope, such as `["https://mail.google.com/"]` for Gmail access
   - Create a callback handler that exchanges the authorization code for tokens using `oAuth2Client.getToken(code)`

6. Run the application and access it in your browser:
   ```bash
   node index.js
   ```

7. Complete the OAuth flow:
   - Navigate to your application URL (e.g., `http://localhost:8080`)
   - Click the login button and authorize the application
   - After successful authorization, you'll receive a JSON response containing your tokens
   - Copy the `refresh_token` value for use in the extension configuration


##### Sample Typescript Refresh Token App

```javascript
const express = require("express");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

// Load environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Initialize express
const app = express();

const REDIRECT_URI = "http://localhost:8080/oauth/callback";

// Initialize OAuth client
const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Root route handler - immediately redirect to Google OAuth
const rootHandler = (_req, res) => {
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://mail.google.com/"], // Full Gmail access
  });

  // Redirect user directly to Google OAuth consent page
  res.redirect(authorizeUrl);
};

// OAuth callback handler
const callbackHandler = async (req, res) => {
  const code = req.query.code;

  if (!code) {
    res.status(400).send("No code provided");
    return;
  }

  try {
    console.log("Exchanging code for tokens...");
    const { tokens } = await oAuth2Client.getToken(code);
    
    // Log all tokens for debugging
    console.log("\nToken response:");
    console.log(tokens);
    
    // Check if refresh token exists
    if (!tokens.refresh_token) {
      return res.status(400).send("No refresh token received. Make sure you've set 'prompt: consent' and 'access_type: offline' in the authorization URL.");
    }

    // Send the refresh token in a simple HTML page with just a paragraph
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Refresh Token</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          p { word-break: break-all; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>Your OAuth Refresh Token</h1>
        <p>${tokens.refresh_token}</p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(
      "Error exchanging code for tokens:",
      error instanceof Error ? error.message : "Unknown error"
    );
    res.status(500).send("Error getting tokens");
  }
};

// Routes
app.get("/", rootHandler);
app.get("/oauth/callback", callbackHandler);

// Start server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

##### Step 4: Configure the Firestore Send Email Extension

When installing the extension, select "OAuth2" as the Authentication Type and provide the following parameters:

- **OAuth2 SMTP Host**: `smtp.gmail.com` (for Gmail)
- **OAuth2 SMTP Port**: `465` (for SMTPS) or `587` (for STARTTLS)
- **Use Secure OAuth2 Connection**: `true` (for port 465) or `false` (for port 587)
- **OAuth2 Client ID**: Your Client ID from GCP
- **OAuth2 Client Secret**: Your Client Secret from GCP
- **OAuth2 Refresh Token**: The refresh token generated in Step 3
- **SMTP User**: Your full Gmail email address

##### Troubleshooting

###### Refresh Token Expiration

- **Testing Status**: If your OAuth consent screen is in "Testing" status, refresh tokens expire after 7 days unless User Type is set to "Internal"
- **Solution**: Either publish your app or ensure User Type is set to "Internal" in the OAuth consent screen settings

###### Scope Issues

- **Problem**: If you see authentication errors, you might not have the correct scopes
- **Solution**: Ensure you've added `https://mail.google.com/` as a scope in both the OAuth consent screen and in the OAuth URL generation code

###### Access Denied

- **Problem**: "Access denied" errors when sending emails
- **Solution**: Make sure the Gmail account has allowed less secure app access or that you've correctly set up OAuth2

###### Additional Resources

- [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Nodemailer OAuth2 Guide](https://nodemailer.com/smtp/oauth2/)
- [Firebase Extensions Documentation](https://firebase.google.com/docs/extensions)

#### Automatic Deletion of Email Documents

To use Firestore's TTL feature for automatic deletion of expired email documents, the extension provides several configuration parameters.

The extension will set a TTL field in the email documents, but you will need to manually configure a TTL policy for the collection/collection group the extension targets, on the `delivery.expireAt` field.

Detailed instructions for creating a TTL field can be found in the [Firestore TTL Policy documentation](https://firebase.google.com/docs/firestore/ttl).

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))

Usage of this extension also requires you to have SMTP credentials for mail delivery. You are responsible for any associated costs with your usage of your SMTP provider.

#### Further reading & resources

You can find more information about this extension in the following articles:

- [Sending Emails Using Firestore And Firebase Extensions](https://invertase.link/Y6Nu)