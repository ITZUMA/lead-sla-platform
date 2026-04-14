import type { Stage } from './types';

// Odoo CRM stage ID → stage name mapping
// Source: CRM Stages (crm.stage) export
const ODOO_STAGE_MAP: Record<number, string> = {
  23: 'New',
  1: 'Contacted',
  5: 'Contacted Attempted',
  27: 'Qualifying',
  6: 'Sourcing Product',
  3: 'Quoted',
  14: 'Contact Made',
  26: 'Deal Committed',
  2: 'Later Date Follow Up',
  15: 'Needs Assessment',
  4: 'Won',
  20: 'Needs Assessment',
  28: 'Nurture',
  7: 'COLD/LOST',
  16: 'Qualified',
  24: 'Obsolete Parts',
  12: 'In-Transit',
  21: 'Qualified',
  25: 'Low Value Leads',
  9: '** ISSUES & RETURNS **',
  17: 'Unqualified',
  11: 'SPAM',
  22: 'Unqualified',
  18: 'Contact Attempted',
  19: 'Contact Made',
};

// Map Odoo stage names to SLA-monitored stages
// Only these stages have SLA rules; others are tracked but not SLA-monitored
const SLA_STAGE_MAP: Record<string, Stage> = {
  'New': 'New',
  'Contacted': 'Contact Attempt',
  'Contacted Attempted': 'Contact Attempt',
  'Contact Attempted': 'Contact Attempt',
  'Contact Made': 'Contact Attempt',
  'Qualifying': 'Qualifying',
  'Qualified': 'Qualifying',
  'Needs Assessment': 'Qualifying',
  'Sourcing Product': 'Sourcing Product',
  'Quoted': 'Quoted / Finance',
  'Deal Committed': 'Committed Sale',
};

export function getStageNameFromId(stageId: number): string {
  return ODOO_STAGE_MAP[stageId] || `Unknown (${stageId})`;
}

export function getSlaStage(stageName: string): Stage | null {
  return SLA_STAGE_MAP[stageName] || null;
}
