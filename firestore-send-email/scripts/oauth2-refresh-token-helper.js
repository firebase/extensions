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

// Configuration constants
const DEFAULT_PORT = 8080;
const DEFAULT_OUTPUT_FILE = "refresh_token.txt";
const AUTH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const SERVER_SHUTDOWN_DELAY_MS = 3000;

/**
 * Parses command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    port: DEFAULT_PORT,
    clientId: "",
    clientSecret: "",
    outputFile: DEFAULT_OUTPUT_FILE,
    showHelp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--port":
      case "-p":
        config.port = parseInt(args[++i], 10) || DEFAULT_PORT;
        break;
      case "--id":
      case "-i":
        config.clientId = args[++i] || "";
        break;
      case "--secret":
      case "-s":
        config.clientSecret = args[++i] || "";
        break;
      case "--output":
      case "-o":
        config.outputFile = args[++i] || DEFAULT_OUTPUT_FILE;
        break;
      case "--help":
      case "-h":
        config.showHelp = true;
        break;
    }
  }

  return config;
}

/**
 * Shows help information
 */
function displayHelp() {
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
}

/**
 * Opens a browser with the specified URL
 * @param {string} url - URL to open
 */
function openBrowser(url) {
  console.log("Opening browser...");

  const commands = {
    win32: `start ${url}`,
    darwin: `open ${url}`,
    default: `xdg-open ${url}`,
  };

  const command = commands[os.platform()] || commands.default;

  exec(command, (error) => {
    if (error) {
      console.log(`Error opening browser: ${error.message}`);
      console.log(`Please open your browser and navigate to ${url}`);
    }
  });
}

/**
 * Creates the HTTP server to handle OAuth flow
 * @param {Object} options - Server configuration options
 * @returns {Promise<string>} The refresh token
 */
function createAuthServer({
  clientId,
  clientSecret,
  port,
  redirectUrl,
  outputFile,
}) {
  return new Promise((resolve, reject) => {
    let codeResolver;
    const codePromise = new Promise((resolve) => {
      codeResolver = resolve;
    });

    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // Handle routes
      if (pathname === "/") {
        handleRootRoute(res, { clientId, redirectUrl });
      } else if (pathname === "/oauth/callback") {
        await handleCallbackRoute(req, res, {
          clientId,
          clientSecret,
          redirectUrl,
          outputFile,
          codeResolver,
          server,
          resolve,
        });
      } else {
        // Not found for all other routes
        res.writeHead(404);
        res.end("Not found");
      }
    });

    // Set a timeout for the entire process
    const timeout = setTimeout(() => {
      console.log("Timeout waiting for authentication");
      server.close();
      reject(new Error("Authentication timeout"));
    }, AUTH_TIMEOUT_MS);

    // Start the server
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      openBrowser(`http://localhost:${port}`);
    });

    // Wait for the code and process it
    codePromise
      .then((code) => {
        console.log("Exchanging code for tokens...");
        clearTimeout(timeout);
      })
      .catch((error) => {
        clearTimeout(timeout);
        server.close();
        reject(error);
      });
  });
}

/**
 * Handles the root route - redirects to Google OAuth
 */
function handleRootRoute(res, { clientId, redirectUrl }) {
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
}

/**
 * Handles the OAuth callback route
 */
async function handleCallbackRoute(req, res, options) {
  const {
    clientId,
    clientSecret,
    redirectUrl,
    outputFile,
    codeResolver,
    server,
    resolve,
  } = options;

  const parsedUrl = url.parse(req.url, true);
  const code = parsedUrl.query.code;

  if (!code) {
    res.writeHead(400);
    res.end("No code provided");
    return;
  }

  try {
    // Notify that we received the code
    codeResolver(code);

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
    });

    const tokens = await tokenResponse.json();
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      sendErrorResponse(res);
      return;
    }

    // Save the refresh token to file
    const tokenFilePath = path.join(process.cwd(), outputFile);
    fs.writeFileSync(tokenFilePath, refreshToken, { mode: 0o600 });

    // Send success response
    sendSuccessResponse(res, { refreshToken, outputFile });

    console.log("\n✅ Successfully obtained refresh token!");
    console.log(`\n✅ Saved refresh token to ${tokenFilePath}`);

    // Wait a bit before shutting down
    setTimeout(() => {
      console.log("\nToken generation complete! Shutting down...");
      server.close();
      resolve(refreshToken);
    }, SERVER_SHUTDOWN_DELAY_MS);
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    res.writeHead(500);
    res.end("Error exchanging code for token");
  }
}

/**
 * Sends an error response when no refresh token is received
 */
function sendErrorResponse(res) {
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
}

/**
 * Sends a success response with the refresh token
 */
function sendSuccessResponse(res, { refreshToken, outputFile }) {
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
}

/**
 * Main function to start the OAuth flow
 */
async function main() {
  try {
    // Initialize config
    const config = parseArguments();

    // Show help if requested
    if (config.showHelp) {
      displayHelp();
      process.exit(0);
    }

    // Setup console display
    console.log("====================================");
    console.log("Google OAuth Refresh Token Generator");
    console.log("====================================\n");

    // Check environment variable if port not provided
    if (!config.port) {
      const portEnv = process.env.PORT;
      if (portEnv) {
        const parsedPort = parseInt(portEnv, 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
          config.port = parsedPort;
        } else {
          console.log(`Invalid PORT environment variable: ${portEnv}`);
          config.port = DEFAULT_PORT;
        }
      } else {
        config.port = DEFAULT_PORT;
      }
    }

    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Get credentials
    config.clientId = config.clientId || process.env.CLIENT_ID;
    config.clientSecret = config.clientSecret || process.env.CLIENT_SECRET;

    if (!config.clientId) {
      config.clientId = await new Promise((resolve) => {
        rl.question("Enter your Google OAuth Client ID: ", (answer) =>
          resolve(answer)
        );
      });
    }

    if (!config.clientSecret) {
      config.clientSecret = await new Promise((resolve) => {
        rl.question("Enter your Google OAuth Client Secret: ", (answer) =>
          resolve(answer)
        );
      });
    }

    if (!config.clientId || !config.clientSecret) {
      console.error("Error: Client ID and Client Secret are required");
      rl.close();
      process.exit(1);
    }

    // Set up OAuth parameters
    const redirectUrl = `http://localhost:${config.port}/oauth/callback`;
    console.log(`\nUsing redirect URI: ${redirectUrl}`);
    console.log(
      "Make sure this exact URI is added to your OAuth consent screen redirects\n"
    );

    // Start the authentication server
    await createAuthServer({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      port: config.port,
      redirectUrl,
      outputFile: config.outputFile,
    });

    rl.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
