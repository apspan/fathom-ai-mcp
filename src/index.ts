#!/usr/bin/env node

import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { FathomClient } from "./fathom-client.js";
import { registerTools } from "./tools.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const transportFlag = process.argv.includes("--transport")
  ? process.argv[process.argv.indexOf("--transport") + 1]
  : "stdio";

const portFlag = process.argv.includes("--port")
  ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
  : 3000;

function createMcpServer(apiKey: string) {
  const server = new McpServer({ name: "fathom-ai", version });
  const client = new FathomClient(apiKey);
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
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, X-Fathom-Api-Key",
      });
      res.end();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    const apiKey = req.headers["x-fathom-api-key"] as string | undefined;
    if (!apiKey) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing X-Fathom-Api-Key header" }));
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.url === "/mcp") {
      const server = createMcpServer(apiKey);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);

      const body = await new Promise<string>((resolve) => {
        let data = "";
        req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        req.on("end", () => resolve(data));
      });

      await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(portFlag, () => {
    console.log(`Fathom AI MCP server (HTTP) listening on port ${portFlag}`);
    console.log(`Endpoint: http://localhost:${portFlag}/mcp`);
  });
} else {
  console.error(`Unknown transport: ${transportFlag}. Use "stdio" or "http".`);
  process.exit(1);
}
