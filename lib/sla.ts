import type { Lead, SlaRuleConfig, SlaStatus, Stage } from './types';

// Business hours config: PST (America/Los_Angeles), Mon-Fri 7:30 AM - 4:00 PM
const BIZ_TZ = 'America/Los_Angeles';
const BIZ_START_HOUR = 7;
const BIZ_START_MIN = 30;
const BIZ_END_HOUR = 16;
const BIZ_END_MIN = 0;
const BIZ_MINUTES_PER_DAY = (BIZ_END_HOUR * 60 + BIZ_END_MIN) - (BIZ_START_HOUR * 60 + BIZ_START_MIN); // 510 min = 8.5h

const HOUR_MS = 60 * 60 * 1000;
const BIZ_DAY_MS = BIZ_MINUTES_PER_DAY * 60 * 1000; // 8.5h in ms

// SLA rules defined in business hours/days
export const SLA_RULES: Record<Stage, SlaRuleConfig> = {
  'New': {
    max_idle_ms: 1 * HOUR_MS, // 1 business hour
    label: 'HIGHEST ALERT',
    alert_level: 'highest',
    recipients: ['Sales Manager', 'Salesman'],
  },
  'Contact Attempt': {
    max_idle_ms: 3 * BIZ_DAY_MS, // 3 business days
    label: 'High',
    alert_level: 'high',
    recipients: ['Sales Manager'],
  },
  'Qualifying': {
    max_idle_ms: 5 * BIZ_DAY_MS, // 5 business days
    label: 'Medium',
    alert_level: 'medium',
    recipients: ['Sales Manager'],
  },
  'Sourcing Product': {
    max_idle_ms: 7 * BIZ_DAY_MS, // 7 business days
    label: 'High',
    alert_level: 'high',
    recipients: ['Sales Manager', 'COO'],
  },
  'Quoted / Finance': {
    max_idle_ms: 10 * BIZ_DAY_MS, // 10 business days
    label: 'Medium',
    alert_level: 'medium',
    recipients: ['Sales Manager'],
  },
  'Committed Sale': {
    max_idle_ms: 5 * BIZ_DAY_MS, // 5 business days
    label: 'Critical',
    alert_level: 'critical',
    recipients: ['Sales Manager', 'CEO'],
  },
};

// Convert a UTC Date to PST date parts
function toPST(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const pst = new Date(date.toLocaleString('en-US', { timeZone: BIZ_TZ }));
  return {
    year: pst.getFullYear(),
    month: pst.getMonth(),
    day: pst.getDate(),
    hour: pst.getHours(),
    minute: pst.getMinutes(),
    dayOfWeek: pst.getDay(), // 0=Sun, 1=Mon, ..., 6=Sat
  };
}

// Check if a PST time is within business hours (Mon-Fri 7:30-16:00)
function isBusinessTime(pst: { hour: number; minute: number; dayOfWeek: number }): boolean {
  if (pst.dayOfWeek === 0 || pst.dayOfWeek === 6) return false; // Weekend
  const mins = pst.hour * 60 + pst.minute;
  return mins >= (BIZ_START_HOUR * 60 + BIZ_START_MIN) && mins < (BIZ_END_HOUR * 60 + BIZ_END_MIN);
}

// Get minutes from start of business day for a given PST time
function bizMinutesInDay(hour: number, minute: number): number {
  const mins = hour * 60 + minute;
  const bizStart = BIZ_START_HOUR * 60 + BIZ_START_MIN;
  const bizEnd = BIZ_END_HOUR * 60 + BIZ_END_MIN;
  if (mins <= bizStart) return 0;
  if (mins >= bizEnd) return BIZ_MINUTES_PER_DAY;
  return mins - bizStart;
}

/**
 * Calculate elapsed business minutes between two timestamps.
 * Business hours: Mon-Fri 7:30 AM - 4:00 PM PST (Vancouver).
 *
 * Examples:
 * - Lead at 3:40 PM Friday → 20 min counted Friday, resumes Monday 7:30 AM
 * - Lead at Saturday 2 PM → 0 min, starts Monday 7:30 AM
 * - Lead at 3:40 PM Wednesday → 20 min Wednesday, resumes Thursday 7:30 AM
 */
export function getBusinessMinutes(startUtc: Date, endUtc: Date): number {
  if (endUtc <= startUtc) return 0;

  let totalMinutes = 0;

  // Walk day by day in PST
  const start = toPST(startUtc);
  const end = toPST(endUtc);

  // Create a cursor date in PST
  let cursorDate = new Date(startUtc.toLocaleString('en-US', { timeZone: BIZ_TZ }));
  const endDate = new Date(endUtc.toLocaleString('en-US', { timeZone: BIZ_TZ }));

  // If same calendar day in PST
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    if (start.dayOfWeek >= 1 && start.dayOfWeek <= 5) { // Weekday
      const startBiz = bizMinutesInDay(start.hour, start.minute);
      const endBiz = bizMinutesInDay(end.hour, end.minute);
      return Math.max(0, endBiz - startBiz);
    }
    return 0; // Weekend
  }

  // First partial day
  if (start.dayOfWeek >= 1 && start.dayOfWeek <= 5) { // Weekday
    const startBiz = bizMinutesInDay(start.hour, start.minute);
    totalMinutes += BIZ_MINUTES_PER_DAY - startBiz;
  }

  // Move to next day
  cursorDate.setDate(cursorDate.getDate() + 1);
  cursorDate.setHours(0, 0, 0, 0);

  // Full days in between
  while (
    cursorDate.getFullYear() < endDate.getFullYear() ||
    cursorDate.getMonth() < endDate.getMonth() ||
    cursorDate.getDate() < endDate.getDate()
  ) {
    const dow = cursorDate.getDay();
    if (dow >= 1 && dow <= 5) { // Weekday
      totalMinutes += BIZ_MINUTES_PER_DAY;
    }
    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  // Last partial day (if it's a weekday)
  if (end.dayOfWeek >= 1 && end.dayOfWeek <= 5) {
    totalMinutes += bizMinutesInDay(end.hour, end.minute);
  }

  return totalMinutes;
}

export function getBusinessMs(startUtc: Date, endUtc: Date): number {
  return getBusinessMinutes(startUtc, endUtc) * 60 * 1000;
}

export function checkSLA(lead: Pick<Lead, 'stage' | 'stage_entered_at'>): SlaStatus {
  const rule = SLA_RULES[lead.stage as Stage];
  if (!rule) return 'ok';

  const stageStart = new Date(lead.stage_entered_at);
  const now = new Date();
  const bizMs = getBusinessMs(stageStart, now);

  if (bizMs >= rule.max_idle_ms) return 'breached';
  if (bizMs >= rule.max_idle_ms * 0.8) return 'warning';
  return 'ok';
}

export function getIdleTime(stageEnteredAt: string): string {
  const stageStart = new Date(stageEnteredAt);
  const now = new Date();
  const bizMinutes = getBusinessMinutes(stageStart, now);

  if (bizMinutes < 60) return `${Math.round(bizMinutes)}m`;
  const bizHours = bizMinutes / 60;
  if (bizHours < BIZ_MINUTES_PER_DAY / 60) return `${Math.round(bizHours * 10) / 10}h`;
  const bizDays = bizMinutes / BIZ_MINUTES_PER_DAY;
  return `${Math.round(bizDays * 10) / 10}d`;
}

export function getMaxIdleLabel(stage: Stage): string {
  const rule = SLA_RULES[stage];
  if (!rule) return 'N/A';
  if (rule.max_idle_ms < BIZ_DAY_MS) {
    return `${rule.max_idle_ms / HOUR_MS}h`;
  }
  return `${rule.max_idle_ms / BIZ_DAY_MS}d`;
}
