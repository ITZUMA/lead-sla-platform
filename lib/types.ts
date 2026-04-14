export type SlaStatus = 'ok' | 'warning' | 'breached';

export type Stage =
  | 'New'
  | 'Contact Attempt'
  | 'Qualifying'
  | 'Sourcing Product'
  | 'Quoted / Finance'
  | 'Committed Sale';

export interface Lead {
  id: string;
  odoo_lead_id: number;
  lead_name: string;
  partner_name: string;
  salesperson: string;
  salesperson_email: string;
  stage: Stage;
  stage_entered_at: string;
  sla_status: SlaStatus;
  sla_breached_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  lead_id: string;
  stage: string;
  alert_type: string;
  message: string;
  sent_to: string;
  google_chat_response: Record<string, unknown> | null;
  created_at: string;
  lead?: Lead;
}

export interface Settings {
  id: string;
  google_chat_webhook_url: string;
  sla_rules: Record<string, SlaRuleConfig>;
  alert_recipients: Record<string, string[]>;
}

export interface SlaRuleConfig {
  max_idle_ms: number;
  label: string;
  alert_level: 'medium' | 'high' | 'critical' | 'highest';
  recipients: string[];
}

export interface OdooWebhookPayload {
  lead_id: number;
  lead_name: string;
  partner_name: string;
  salesperson: string;
  salesperson_email: string;
  stage: Stage;
  last_stage_update: string; // Odoo datetime field
  stage_entered_at?: string; // alias, kept for backwards compat
}
