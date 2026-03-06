#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FathomClient } from "./fathom-client.js";
import { registerTools } from "./tools.js";

const apiKey = process.env.FATHOM_API_KEY;
if (!apiKey) {
  console.error("FATHOM_API_KEY environment variable is required");
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
