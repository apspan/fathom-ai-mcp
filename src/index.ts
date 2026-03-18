#!/usr/bin/env node

import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { FathomClient } from "./fathom-client.js";
import { registerTools } from "./tools.js";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const transportFlag = process.argv.includes("--transport")
  ? process.argv[process.argv.indexOf("--transport") + 1]
  : "stdio";

const portFlag = process.argv.includes("--port")
  ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
  : 3000;

function createMcpServer(credential: string, authMode: "api-key" | "bearer" = "api-key") {
  const server = new McpServer({ name: "fathom-ai", version });
  const client = new FathomClient(credential, authMode);
  registerTools(server, client);
  return server;
}

if (transportFlag === "stdio") {
  const apiKeyFlagIndex = process.argv.indexOf("--api-key");
  const apiKey = (apiKeyFlagIndex !== -1 ? process.argv[apiKeyFlagIndex + 1] : undefined) ?? process.env.FATHOM_API_KEY;
  if (!apiKey) {
    console.error("Provide an API key via --api-key or FATHOM_API_KEY environment variable");
    process.exit(1);
  }

  const server = createMcpServer(apiKey);
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else if (transportFlag === "http") {
  const { default: express } = await import("express");
  const { mcpAuthRouter } = await import("@modelcontextprotocol/sdk/server/auth/router.js");
  const { requireBearerAuth } = await import("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js");
  const { FathomOAuthProvider } = await import("./auth.js");

  const app = express();

  // OAuth configuration (optional — if not set, only X-Fathom-Api-Key mode works)
  const oauthEnabled = !!(process.env.FATHOM_OAUTH_CLIENT_ID && process.env.FATHOM_OAUTH_CLIENT_SECRET && process.env.SERVER_BASE_URL);

  let provider: InstanceType<typeof FathomOAuthProvider> | undefined;

  if (oauthEnabled) {
    provider = new FathomOAuthProvider({
      fathomClientId: process.env.FATHOM_OAUTH_CLIENT_ID!,
      fathomClientSecret: process.env.FATHOM_OAUTH_CLIENT_SECRET!,
      fathomAuthorizeUrl: process.env.FATHOM_OAUTH_AUTHORIZE_URL ?? "https://fathom.video/oauth/authorize",
      fathomTokenUrl: process.env.FATHOM_OAUTH_TOKEN_URL ?? "https://fathom.video/external/v1/oauth2/token",
      serverBaseUrl: process.env.SERVER_BASE_URL!,
    });

    // OAuth endpoints (/.well-known/*, /authorize, /token, /register)
    app.use(mcpAuthRouter({
      provider,
      issuerUrl: new URL(process.env.SERVER_BASE_URL!),
      scopesSupported: ["public_api"],
    }));

    // Fathom OAuth callback
    app.get("/callback", provider.createCallbackHandler());

    console.log("OAuth mode enabled");
  }

  // Health check (no auth)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // MCP handler
  async function handleMcp(req: Request, res: Response, credential: string, authMode: "api-key" | "bearer") {
    const server = createMcpServer(credential, authMode);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // Parse JSON body for /mcp
  app.use("/mcp", express.json());

  // CORS for /mcp
  app.options("/mcp", (_req: Request, res: Response) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, X-Fathom-Api-Key, Authorization",
    });
    res.sendStatus(204);
  });

  // Build middleware chain for /mcp
  const mcpHandlers: RequestHandler[] = [
    // First: check for legacy X-Fathom-Api-Key header
    ((req: Request, res: Response, next: NextFunction) => {
      res.set("Access-Control-Allow-Origin", "*");

      const apiKey = req.headers["x-fathom-api-key"] as string | undefined;
      if (apiKey) {
        handleMcp(req, res, apiKey, "api-key").catch(next);
        return;
      }

      if (provider) {
        next();
      } else {
        res.status(401).json({ error: "Missing X-Fathom-Api-Key header (OAuth not configured)" });
      }
    }) as RequestHandler,
  ];

  if (oauthEnabled && provider) {
    mcpHandlers.push(requireBearerAuth({ verifier: provider }));
    mcpHandlers.push(((req: Request, res: Response, next: NextFunction) => {
      handleMcp(req, res, req.auth!.token, "bearer").catch(next);
    }) as RequestHandler);
  }

  app.all("/mcp", ...mcpHandlers);

  app.listen(portFlag, () => {
    console.log(`Fathom AI MCP server (HTTP) listening on port ${portFlag}`);
    console.log(`Endpoint: http://localhost:${portFlag}/mcp`);
    if (oauthEnabled) {
      console.log(`OAuth callback: ${process.env.SERVER_BASE_URL}/callback`);
    }
  });
} else {
  console.error(`Unknown transport: ${transportFlag}. Use "stdio" or "http".`);
  process.exit(1);
}
