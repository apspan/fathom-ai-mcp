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

- Node.js 18+
- A Fathom AI API key (get one from your Fathom account settings)

### Quick start (via npx)

```bash
claude mcp add fathom -- npx -y fathom-ai-mcp
```

Then set your API key in `~/.claude.json`:

```json
{
  "mcpServers": {
    "fathom": {
      "command": "npx",
      "args": ["-y", "fathom-ai-mcp"],
      "env": {
        "FATHOM_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Alternative: install from source

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

### Claude Desktop

Add the same config to your `claude_desktop_config.json` (either the npx or absolute path version).

## Usage examples

Once configured, ask Claude things like:

- "List my recent Fathom meetings"
- "Get the transcript for recording 12345"
- "Summarize my meeting from yesterday"
- "Show me all team members"

## API reference

This server wraps the [Fathom External API v1](https://developers.fathom.ai). Authentication uses the `X-Api-Key` header. The server will refuse to start if `FATHOM_API_KEY` is not set.
