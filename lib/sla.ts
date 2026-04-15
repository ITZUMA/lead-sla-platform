import type { Lead, SlaStatus } from './types';

// Business hours config: PST (America/Los_Angeles), Mon-Fri 7:30 AM - 4:00 PM
const BIZ_TZ = 'America/Los_Angeles';
const BIZ_START_HOUR = 7;
const BIZ_START_MIN = 30;
const BIZ_END_HOUR = 16;
const BIZ_END_MIN = 0;
export const BIZ_MINUTES_PER_DAY = (BIZ_END_HOUR * 60 + BIZ_END_MIN) - (BIZ_START_HOUR * 60 + BIZ_START_MIN); // 510 min = 8.5h

// Convert a UTC Date to PST date parts
function toPST(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const pst = new Date(date.toLocaleString('en-US', { timeZone: BIZ_TZ }));
  return {
    year: pst.getFullYear(),
    month: pst.getMonth(),
    day: pst.getDate(),
    hour: pst.getHours(),
    minute: pst.getMinutes(),
    dayOfWeek: pst.getDay(),
  };
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
 */
export function getBusinessMinutes(startUtc: Date, endUtc: Date): number {
  if (endUtc <= startUtc) return 0;

  let totalMinutes = 0;

  const start = toPST(startUtc);
  const end = toPST(endUtc);

  const cursorDate = new Date(startUtc.toLocaleString('en-US', { timeZone: BIZ_TZ }));
  const endDate = new Date(endUtc.toLocaleString('en-US', { timeZone: BIZ_TZ }));

  // Same calendar day
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    if (start.dayOfWeek >= 1 && start.dayOfWeek <= 5) {
      const startBiz = bizMinutesInDay(start.hour, start.minute);
      const endBiz = bizMinutesInDay(end.hour, end.minute);
      return Math.max(0, endBiz - startBiz);
    }
    return 0;
  }

  // First partial day
  if (start.dayOfWeek >= 1 && start.dayOfWeek <= 5) {
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
    if (dow >= 1 && dow <= 5) totalMinutes += BIZ_MINUTES_PER_DAY;
    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  // Last partial day
  if (end.dayOfWeek >= 1 && end.dayOfWeek <= 5) {
    totalMinutes += bizMinutesInDay(end.hour, end.minute);
  }

  return totalMinutes;
}

export function getBusinessMs(startUtc: Date, endUtc: Date): number {
  return getBusinessMinutes(startUtc, endUtc) * 60 * 1000;
}

/**
 * Check SLA status against a given threshold in minutes.
 * No defaults — slaMinutes is required. Returns 'ok' if not provided.
 */
export function checkSLA(
  lead: Pick<Lead, 'stage_entered_at'>,
  slaMinutes?: number | null,
): SlaStatus {
  if (!slaMinutes) return 'ok';

  const maxIdleMs = slaMinutes * 60 * 1000;
  const stageStart = new Date(lead.stage_entered_at);
  const now = new Date();
  const bizMs = getBusinessMs(stageStart, now);

  if (bizMs >= maxIdleMs) return 'breached';
  if (bizMs >= maxIdleMs * 0.8) return 'warning';
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

export function formatSlaMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < BIZ_MINUTES_PER_DAY) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / BIZ_MINUTES_PER_DAY).toFixed(1)}d`;
}
