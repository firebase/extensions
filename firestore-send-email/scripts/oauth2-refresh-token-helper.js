#!/usr/bin/env node

/**
 * Google OAuth Refresh Token Generator
 *
 * A standalone script that helps obtain a refresh token for Google APIs
 * without requiring npm install.
 *
 * NOTE: An alternative approach is to use the official google-auth-library:
 * ---------------------------------------------------------------------
 * If you're working in a Node.js environment where you can use npm packages,
 * consider using the official google-auth-library instead:
 *
 * 1. Install the library: npm install google-auth-library
 * 2. Then use it like this:
 *    ```
 *    import { OAuth2Client } from "google-auth-library";
 *
 *    // Initialize OAuth client
 *    const REDIRECT_URI = "http://localhost:8080/oauth/callback";
 *    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
 *
 *    // Generate authorization URL
 *    const authorizeUrl = oAuth2Client.generateAuthUrl({
 *      access_type: "offline",
 *      prompt: "consent",
 *      scope: ["https://mail.google.com/"],  // Full Gmail access
 *    });
 *
 *    // After receiving the code from the callback:
 *    const { tokens } = await oAuth2Client.getToken(code);
 *    const refreshToken = tokens.refresh_token;
 *    ```
 *
 * This approach integrates better with other Google services and handles
 * token refresh automatically when using the library for API calls.
 */

// Core Node.js modules
const http = require("http");
const url = require("url");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");

// Parse command line arguments
const args = process.argv.slice(2);
let port = 8080;
let clientId = "";
let clientSecret = "";
let outputFile = "refresh_token.txt";
let showHelp = false;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "--port" || arg === "-p") {
    port = parseInt(args[++i], 10) || 8080;
  } else if (arg === "--id" || arg === "-i") {
    clientId = args[++i] || "";
  } else if (arg === "--secret" || arg === "-s") {
    clientSecret = args[++i] || "";
  } else if (arg === "--output" || arg === "-o") {
    outputFile = args[++i] || "refresh_token.txt";
  } else if (arg === "--help" || arg === "-h") {
    showHelp = true;
  }
}

// Show help if requested
if (showHelp) {
  console.log("Google OAuth Refresh Token Generator");
  console.log("\nThis tool helps you obtain a refresh token for Google APIs.");
  console.log(
    "It starts a local web server, opens your browser for authentication,"
  );
  console.log("and saves the refresh token to a file.");
  console.log("\nUsage:");
  console.log(
    "  --port, -p     Port to run the server on (default: 8080 or PORT env var)"
  );
  console.log("  --id, -i       Google OAuth Client ID");
  console.log("  --secret, -s   Google OAuth Client Secret");
  console.log(
    "  --output, -o   Output file to save the refresh token (default: refresh_token.txt)"
  );
  console.log("  --help, -h     Show this help information");
  console.log("\nEnvironment Variables:");
  console.log(
    "  PORT           Port to run the server on (if --port not specified)"
  );
  console.log(
    "  CLIENT_ID      Google OAuth Client ID (if --id not specified)"
  );
  console.log(
    "  CLIENT_SECRET  Google OAuth Client Secret (if --secret not specified)"
  );
  process.exit(0);
}

// Check environment variable if port not provided
if (!port) {
  const portEnv = process.env.PORT;
  if (portEnv) {
    port = parseInt(portEnv, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      console.log(`Invalid PORT environment variable: ${portEnv}`);
      port = 8080;
    }
  } else {
    port = 8080;
  }
}

console.log("====================================");
console.log("Google OAuth Refresh Token Generator");
console.log("====================================\n");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function to start the OAuth flow
async function main() {
  try {
    // Get credentials
    clientId = clientId || process.env.CLIENT_ID;
    clientSecret = clientSecret || process.env.CLIENT_SECRET;

    if (!clientId) {
      clientId = await new Promise((resolve) => {
        rl.question("Enter your Google OAuth Client ID: ", (answer) =>
          resolve(answer)
        );
      });
    }

    if (!clientSecret) {
      clientSecret = await new Promise((resolve) => {
        rl.question("Enter your Google OAuth Client Secret: ", (answer) =>
          resolve(answer)
        );
      });
    }

    if (!clientId || !clientSecret) {
      console.error("Error: Client ID and Client Secret are required");
      process.exit(1);
    }

    // Set up OAuth parameters
    const redirectUrl = `http://localhost:${port}/oauth/callback`;
    console.log(`\nUsing redirect URI: ${redirectUrl}`);
    console.log(
      "Make sure this exact URI is added to your OAuth consent screen redirects\n"
    );

    // Channels for communication between server and main thread
    let resolveCode;
    const codePromise = new Promise((resolve) => {
      resolveCode = resolve;
    });

    let refreshToken = null;

    // Create HTTP server
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // Root route - redirect to Google OAuth
      if (pathname === "/") {
        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent("https://mail.google.com/")}` +
          `&access_type=offline` +
          `&prompt=consent`;

        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }

      // OAuth callback route
      if (pathname === "/oauth/callback") {
        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400);
          res.end("No code provided");
          return;
        }

        try {
          // Exchange code for tokens
          resolveCode(code);

          // Exchange code for tokens using fetch
          const tokenResponse = await fetch(
            "https://oauth2.googleapis.com/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUrl,
                grant_type: "authorization_code",
              }),
            }
          );

          const tokens = await tokenResponse.json();
          refreshToken = tokens.refresh_token;

          if (!refreshToken) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>OAuth Error</title>
                <style>
                  body { font-family: sans-serif; margin: 20px; max-width: 800px; line-height: 1.6; }
                </style>
              </head>
              <body>
                <h1>Error: No Refresh Token Received</h1>
                <p>Make sure you've revoked previous access or forced consent.</p>
              </body>
              </html>
            `);
            return;
          }

          // Save the refresh token to a file
          const tokenFilePath = path.join(process.cwd(), outputFile);
          fs.writeFileSync(tokenFilePath, refreshToken, { mode: 0o600 });

          // Send success page
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>OAuth Refresh Token</title>
              <style>
                body { font-family: sans-serif; margin: 20px; max-width: 800px; line-height: 1.6; }
                p { word-break: break-all; font-family: monospace; background: #f0f0f0; padding: 10px; }
                .success { color: green; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>OAuth Successful!</h1>
              <div class="success">✅ Token successfully generated</div>
              <h2>Your OAuth Refresh Token:</h2>
              <p>${refreshToken}</p>
              <h3>Next Steps:</h3>
              <ul>
                <li>Your refresh token has been saved to <code>${outputFile}</code></li>
                <li>Keep this token secure - it provides access to your Gmail account</li>
                <li>You can now close this window and the program will exit automatically</li>
              </ul>
            </body>
            </html>
          `);

          console.log("\n✅ Successfully obtained refresh token!");
          console.log(`\n✅ Saved refresh token to ${tokenFilePath}`);

          // Wait a bit before shutting down
          setTimeout(() => {
            console.log("\nToken generation complete! Shutting down...");
            server.close();
            rl.close();
            process.exit(0);
          }, 3000);
        } catch (error) {
          console.error("Error exchanging code for token:", error);
          res.writeHead(500);
          res.end("Error exchanging code for token");
        }
        return;
      }

      // Not found for all other routes
      res.writeHead(404);
      res.end("Not found");
    });

    // Start the server
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      openBrowser(`http://localhost:${port}`);
    });

    // Set a timeout for the entire process
    const timeout = setTimeout(() => {
      console.log("Timeout waiting for authentication");
      server.close();
      rl.close();
      process.exit(1);
    }, 2 * 60 * 1000); // 2 minutes

    // Wait for the code from the callback
    const code = await codePromise;
    console.log("Exchanging code for tokens...");

    // Clear the timeout when we get the code
    clearTimeout(timeout);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Function to open the browser
function openBrowser(url) {
  console.log("Opening browser...");

  let command;
  switch (os.platform()) {
    case "win32":
      command = `start ${url}`;
      break;
    case "darwin":
      command = `open ${url}`;
      break;
    default:
      command = `xdg-open ${url}`;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`Error opening browser: ${error.message}`);
      console.log(`Please open your browser and navigate to ${url}`);
    }
  });
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
