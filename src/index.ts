#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FathomClient } from "./fathom-client.js";
import { registerTools } from "./tools.js";

const apiKeyFlagIndex = process.argv.indexOf("--api-key");
const apiKey = (apiKeyFlagIndex !== -1 ? process.argv[apiKeyFlagIndex + 1] : undefined) ?? process.env.FATHOM_API_KEY;
if (!apiKey) {
  console.error("Provide an API key via --api-key or FATHOM_API_KEY environment variable");
  process.exit(1);
}

const server = new McpServer({
  name: "fathom-ai",
  version: "1.0.0",
});

const client = new FathomClient(apiKey);
registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
