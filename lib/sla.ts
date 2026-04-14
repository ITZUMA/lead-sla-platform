import type { Lead, SlaRuleConfig, SlaStatus, Stage } from './types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SLA_RULES: Record<Stage, SlaRuleConfig> = {
  'New': {
    max_idle_ms: 1 * HOUR,
    label: 'HIGHEST ALERT',
    alert_level: 'highest',
    recipients: ['Sales Manager', 'Salesman'],
  },
  'Contact Attempt': {
    max_idle_ms: 3 * DAY,
    label: 'High',
    alert_level: 'high',
    recipients: ['Sales Manager'],
  },
  'Qualifying': {
    max_idle_ms: 5 * DAY,
    label: 'Medium',
    alert_level: 'medium',
    recipients: ['Sales Manager'],
  },
  'Sourcing Product': {
    max_idle_ms: 7 * DAY,
    label: 'High',
    alert_level: 'high',
    recipients: ['Sales Manager', 'COO'],
  },
  'Quoted / Finance': {
    max_idle_ms: 10 * DAY,
    label: 'Medium',
    alert_level: 'medium',
    recipients: ['Sales Manager'],
  },
  'Committed Sale': {
    max_idle_ms: 5 * DAY,
    label: 'Critical',
    alert_level: 'critical',
    recipients: ['Sales Manager', 'CEO'],
  },
};

export function checkSLA(lead: Pick<Lead, 'stage' | 'stage_entered_at'>): SlaStatus {
  const rule = SLA_RULES[lead.stage as Stage];
  if (!rule) return 'ok';

  const idleMs = Date.now() - new Date(lead.stage_entered_at).getTime();
  if (idleMs >= rule.max_idle_ms) return 'breached';
  if (idleMs >= rule.max_idle_ms * 0.8) return 'warning';
  return 'ok';
}

export function getIdleTime(stageEnteredAt: string): string {
  const ms = Date.now() - new Date(stageEnteredAt).getTime();
  if (ms < HOUR) return `${Math.round(ms / 60000)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  const days = Math.round(ms / DAY);
  return `${days}d`;
}

export function getMaxIdleLabel(stage: Stage): string {
  const rule = SLA_RULES[stage];
  if (!rule) return 'N/A';
  if (rule.max_idle_ms < DAY) return `${rule.max_idle_ms / HOUR}h`;
  return `${rule.max_idle_ms / DAY}d`;
}
