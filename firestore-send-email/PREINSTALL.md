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

The extension is agnostic with respect to OAuth2 provider. You just need to provide it with valid Client ID, Client Secret, and Refresh Token parameters.

##### Step 1: Create OAuth Credentials in Google Cloud Platform

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. In the left sidebar, navigate to **APIs & Services > Credentials**
4. Click Create Credentials and select **OAuth client ID**
5. Set the application type to **Web application**
6. Give your OAuth client a name (e.g., "Firestore Send Email Extension")
7. Under **Authorized redirect URIs**, add the URI where you'll receive the OAuth callback, for example, `http://localhost:8080/oauth/callback`.

   **Note**: The redirect URI in your OAuth client settings MUST match exactly the callback URL in your code.

8. Click **Create**.

##### Step 2: Configure OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Choose the appropriate user type:
   - **External**: For applications used by any Google user
   - **Internal**: For applications used only by users in your organization

> **Important Note**: If your OAuth consent screen is in "Testing" status, refresh tokens will expire after 7 days unless the User Type is set to "Internal."

##### Step 3: Generate a Refresh Token

You can use a standalone helper script (`oauth2-refresh-token-helper.js`) that generates a refresh token without requiring any npm installations. 

**Prerequisites:**
- You must have Node.js installed on your machine

**Download the script:**
1. Download the script using curl, wget, or directly from your browser:
   ```bash
   # Using curl
   curl -o oauth2-refresh-token-helper.js https://raw.githubusercontent.com/firebase/extensions/refs/heads/master/firestore-send-email/scripts/oauth2-refresh-token-helper.js
   
   # Using wget
   wget https://raw.githubusercontent.com/firebase/extensions/refs/heads/master/firestore-send-email/scripts/oauth2-refresh-token-helper.js
   ```

   You can also [view the script on GitHub](https://github.com/firebase/extensions/blob/master/firestore-send-email/scripts/oauth2-refresh-token-helper.js) and download it manually.

> **Note**: If you are creating your own application to obtain a refresh token, in a Node.js environment where you can use npm packages, consider using the official google-auth-library instead:
> 
> 1. Install the library: `npm install google-auth-library`
> 2. Then use it like this:
>    ```javascript
>    import { OAuth2Client } from "google-auth-library";
>    
>    // Initialize OAuth client
>    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
>    
>    // Generate authorization URL
>    const authorizeUrl = oAuth2Client.generateAuthUrl({
>      access_type: "offline",
>      prompt: "consent",
>      scope: ["https://mail.google.com/"],  // Full Gmail access
>    });
>    
>    // After receiving the code from the callback:
>    const { tokens } = await oAuth2Client.getToken(code);
>    const refreshToken = tokens.refresh_token;
>    ```

2. Run the script with Node.js:

   ```bash
   node oauth2-refresh-token-helper.js
   ```

3. The script supports the following command-line options:
   ```
   --port, -p     Port to run the server on (default: 8080 or PORT env var)
   --id, -i       Google OAuth Client ID
   --secret, -s   Google OAuth Client Secret
   --output, -o   Output file to save the refresh token (default: refresh_token.txt)
   --help, -h     Show help information
   ```

4. You can either provide your credentials as command-line arguments or set them as environment variables:
   ```bash
   # Using environment variables
   export CLIENT_ID=your_client_id
   export CLIENT_SECRET=your_client_secret
   node oauth2-refresh-token-helper.js

   # Using command-line arguments
   node oauth2-refresh-token-helper.js --id=your_client_id --secret=your_client_secret
   ```

5. The script will:
   - Start a local web server
   - Open your browser to the OAuth consent page
   - Receive the authorization code
   - Exchange the code for tokens
   - Save the refresh token to a file (default: `refresh_token.txt`)
   - Display the refresh token in your browser

6. **Important**: The redirect URI in the script (`http://localhost:8080/oauth/callback` by default) **MUST** match exactly what you configured in the Google Cloud Console OAuth client settings.

7. The script automatically requests the appropriate scope for Gmail access (`https://mail.google.com/`) and sets the authorization parameters to always receive a refresh token (`access_type: "offline"` and `prompt: "consent"`).

##### Step 4: Configure the Firestore Send Email Extension

When installing the extension, select "OAuth2" as the **Authentication Type** and provide the following parameters:

- **OAuth2 SMTP Host**: `smtp.gmail.com` (for Gmail)
- **OAuth2 SMTP Port**: `465` (for SMTPS) or `587` (for STARTTLS)
- **Use Secure OAuth2 Connection**: `true` (for port 465) or `false` (for port 587)
- **OAuth2 Client ID**: Your Client ID from GCP
- **OAuth2 Client Secret**: Your Client Secret from GCP
- **OAuth2 Refresh Token**: The refresh token generated in Step 3
- **SMTP User**: Your full Gmail email address

Leave `Use secure OAuth2 connection?` as the default value `true`.

##### Troubleshooting

###### Refresh Token Expiration

- **Testing Status**: If your OAuth consent screen is in "Testing" status, refresh tokens expire after 7 days unless User Type is set to "Internal"
- **Solution**: Either publish your app or ensure User Type is set to "Internal" in the OAuth consent screen settings

###### No Refresh Token Received

- **Problem**: If you don't receive a refresh token during the OAuth flow
- **Solution**: Make sure you've revoked previous access or forced consent by going to [Google Account Security](https://myaccount.google.com/security) > Third-party apps with account access

###### Scope Issues

- **Problem**: If you see authentication errors, you might not have the correct scopes
- **Solution**: Ensure you've added `https://mail.google.com/` as a scope in the OAuth consent screen

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