import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FathomClient } from "./fathom-client.js";

export function registerTools(server: McpServer, client: FathomClient) {
  server.tool(
    "list_meetings",
    "List Fathom meetings with optional filters. Returns paginated results.",
    {
      created_after: z.string().optional().describe("ISO 8601 datetime. Only return meetings created after this time."),
      created_before: z.string().optional().describe("ISO 8601 datetime. Only return meetings created before this time."),
      recorded_by: z.array(z.string()).optional().describe("Filter by email addresses of the people who recorded the meeting."),
      teams: z.array(z.string()).optional().describe("Team names to filter by."),
      include_transcript: z.boolean().optional().describe("Include transcript in results."),
      include_summary: z.boolean().optional().describe("Include summary in results."),
      include_action_items: z.boolean().optional().describe("Include action items in results."),
      include_crm_matches: z.boolean().optional().describe("Include CRM matches in results."),
      cursor: z.string().optional().describe("Pagination cursor from a previous response."),
      calendar_invitees_domains: z.array(z.string()).optional().describe("Filter by calendar invitee email domains."),
      calendar_invitees_domains_type: z.enum(["all", "only_internal", "one_or_more_external"]).optional().describe("How to apply domain filter: 'all', 'only_internal', or 'one_or_more_external'."),
    },
    async (params) => {
      const result = await client.listMeetings(params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_meeting_summary",
    "Get the summary for a specific Fathom recording.",
    {
      recording_id: z.number().int().describe("The recording ID to get the summary for."),
    },
    async ({ recording_id }) => {
      const result = await client.getRecordingSummary(recording_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_meeting_transcript",
    "Get the transcript for a specific Fathom recording.",
    {
      recording_id: z.number().int().describe("The recording ID to get the transcript for."),
    },
    async ({ recording_id }) => {
      const result = await client.getRecordingTranscript(recording_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_teams",
    "List all teams in the Fathom organization.",
    {
      cursor: z.string().optional().describe("Pagination cursor from a previous response."),
    },
    async ({ cursor }) => {
      const result = await client.listTeams(cursor);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_team_members",
    "List team members, optionally filtered by team.",
    {
      cursor: z.string().optional().describe("Pagination cursor from a previous response."),
      team: z.string().optional().describe("Team name to filter members by."),
    },
    async (params) => {
      const result = await client.listTeamMembers(params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
