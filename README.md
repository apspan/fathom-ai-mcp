# Fathom AI MCP Server

An MCP (Model Context Protocol) server that exposes the [Fathom AI](https://fathom.ai) meeting intelligence API as tools for Claude. List meetings, fetch transcripts and summaries, and browse teams and members directly from Claude.

> This is an unofficial community project, not affiliated with Fathom.

## Tools

| Tool | Description |
|------|-------------|
| `list_meetings` | List meetings with filters (date range, recorder, teams, domains) |
| `get_meeting_summary` | Get the summary for a specific recording |
| `get_meeting_transcript` | Get the transcript for a specific recording |
| `list_teams` | List all teams in the organization |
| `list_team_members` | List team members, optionally filtered by team |

All list endpoints support cursor-based pagination.

## Setup

### Prerequisites

- A Fathom AI API key (get one from your Fathom account settings)
- Node.js 18+ (for local/stdio mode only — not needed for remote HTTP mode)

### Option 1: Quick start via npx (Claude Code)

```bash
claude mcp add fathom -- npx -y fathom-ai-mcp --api-key your-api-key
```

### Option 2: Remote HTTP server (Claude Desktop / Cowork)

Deploy the server centrally (Docker/Kubernetes) so users don't need Node.js installed. Each user passes their own Fathom API key via the `X-Fathom-Api-Key` header.

#### Run with Docker

```bash
docker build -t fathom-ai-mcp .
docker run -p 3000:3000 fathom-ai-mcp
```

#### Configure in Claude Desktop

```json
{
  "mcpServers": {
    "fathom": {
      "url": "https://your-internal-host/mcp",
      "headers": {
        "X-Fathom-Api-Key": "your-api-key"
      }
    }
  }
}
```

#### Server options

```bash
# Default: stdio mode
fathom-ai-mcp --api-key your-key

# HTTP mode on custom port
fathom-ai-mcp --transport http --port 8080
```

### Option 3: Install from source

```bash
git clone git@github.com:apspan/fathom-ai-mcp.git
cd fathom-ai-mcp
npm install
npm run build
```

Then configure with the absolute path:

```json
{
  "mcpServers": {
    "fathom": {
      "command": "node",
      "args": ["/absolute/path/to/fathom-ai-mcp/dist/index.js"],
      "env": {
        "FATHOM_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Usage examples

Once configured, ask Claude things like:

- "List my recent Fathom meetings"
- "Get the transcript for recording 12345"
- "Summarize my meeting from yesterday"
- "Show me all team members"

## API reference

This server wraps the [Fathom External API v1](https://developers.fathom.ai). Authentication uses the `X-Api-Key` header.

### Transport modes

| Mode | Flag | Auth | Use case |
|------|------|------|----------|
| stdio (default) | `--transport stdio` | `--api-key` or `FATHOM_API_KEY` env var | Claude Code, local development |
| HTTP | `--transport http` | `X-Fathom-Api-Key` request header | Remote deployment, Claude Desktop, Cowork |
