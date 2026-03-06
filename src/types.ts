export interface TranscriptItem {
  timestamp: string;
  speaker: {
    display_name: string;
    matched_calendar_invitee_email?: string;
  };
  text: string;
}

export interface MeetingSummary {
  summary: string;
}

export interface ActionItem {
  description: string;
  user_generated: boolean;
  completed: boolean;
  recording_timestamp?: string;
  playback_url?: string;
  assignee?: {
    display_name: string;
    email?: string;
  };
}

export interface Meeting {
  recording_id: number;
  created_at: string;
  title: string;
  duration_seconds: number;
  recorded_by: {
    display_name: string;
    email: string;
  };
  calendar_invitees?: Array<{
    display_name: string;
    email: string;
  }>;
  teams?: string[];
  transcript?: TranscriptItem[];
  summary?: MeetingSummary;
  action_items?: ActionItem[];
  crm_matches?: {
    contacts?: Array<{ name: string; record_url: string }>;
    companies?: Array<{ name: string; record_url: string }>;
    deals?: Array<{ name: string; record_url: string }>;
  };
}

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor?: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  team_id?: string;
}

export interface ListMeetingsParams {
  created_after?: string;
  created_before?: string;
  recorded_by?: string[];
  teams?: string[];
  include_transcript?: boolean;
  include_summary?: boolean;
  include_action_items?: boolean;
  include_crm_matches?: boolean;
  cursor?: string;
  calendar_invitees_domains?: string[];
  calendar_invitees_domains_type?: string;
}

export interface ListTeamMembersParams {
  cursor?: string;
  team?: string;
}
