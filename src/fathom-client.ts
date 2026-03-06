import type { ListMeetingsParams, ListTeamMembersParams } from "./types.js";

const BASE_URL = "https://api.fathom.ai/external/v1";

export class FathomClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(path: string, params?: URLSearchParams): Promise<unknown> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      url.search = params.toString();
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": this.apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fathom API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  async listMeetings(params: ListMeetingsParams = {}) {
    const sp = new URLSearchParams();
    if (params.created_after) sp.set("created_after", params.created_after);
    if (params.created_before) sp.set("created_before", params.created_before);
    if (params.recorded_by) {
      for (const email of params.recorded_by) {
        sp.append("recorded_by[]", email);
      }
    }
    if (params.teams) {
      for (const team of params.teams) {
        sp.append("teams[]", team);
      }
    }
    if (params.include_transcript) sp.set("include_transcript", "true");
    if (params.include_summary) sp.set("include_summary", "true");
    if (params.include_action_items) sp.set("include_action_items", "true");
    if (params.include_crm_matches) sp.set("include_crm_matches", "true");
    if (params.cursor) sp.set("cursor", params.cursor);
    if (params.calendar_invitees_domains) {
      for (const domain of params.calendar_invitees_domains) {
        sp.append("calendar_invitees_domains[]", domain);
      }
    }
    if (params.calendar_invitees_domains_type) sp.set("calendar_invitees_domains_type", params.calendar_invitees_domains_type);
    return this.request("/meetings", sp);
  }

  async getRecordingSummary(recordingId: number) {
    return this.request(`/recordings/${recordingId}/summary`);
  }

  async getRecordingTranscript(recordingId: number) {
    return this.request(`/recordings/${recordingId}/transcript`);
  }

  async listTeams(cursor?: string) {
    const sp = new URLSearchParams();
    if (cursor) sp.set("cursor", cursor);
    return this.request("/teams", sp);
  }

  async listTeamMembers(params: ListTeamMembersParams = {}) {
    const sp = new URLSearchParams();
    if (params.cursor) sp.set("cursor", params.cursor);
    if (params.team) sp.set("team", params.team);
    return this.request("/team_members", sp);
  }
}
