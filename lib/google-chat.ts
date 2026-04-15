import type { Lead, Stage } from './types';
import { SLA_RULES, getIdleTime, getMaxIdleLabel } from './sla';
import { supabase, isSupabaseConfigured } from './supabase';

const STAGE_ACTIONS: Record<Stage, string> = {
  'New': 'Kanban state turns Red. Immediate attention required!',
  'Contact Attempt': 'Kanban state turns Red. Manager alerted. Consider Nurture.',
  'Qualifying': 'Flag for pipeline review.',
  'Sourcing Product': 'Escalation alert. If unit can\'t be found, move to Nurture or Lost (Availability).',
  'Quoted / Finance': 'Flag for follow-up review. Quote going cold?',
  'Committed Sale': 'Red flag. Money should have arrived. Customer backing out?',
};

export interface AlertRoute {
  id: string;
  name: string;
  webhook_url: string;
  stage: string | null;
  team_id: number | null;             // legacy single team
  team_ids: number[] | null;          // multiple teams
  alert_level: string | null;
  lead_type: string | null;           // 'lead', 'opportunity', or null (all)
  sla_override_minutes: number | null; // Custom SLA in minutes (null = use default)
  is_active: boolean;
}

/**
 * Get all matching routes for a lead based on routing rules.
 * Falls back to the default webhook URL from settings if no routes match.
 */
export async function getMatchingRoutes(
  lead: Lead,
): Promise<AlertRoute[]> {
  if (!isSupabaseConfigured) return [];

  const rule = SLA_RULES[lead.stage as Stage];
  const alertLevel = rule?.alert_level || null;

  // Fetch all active routes
  const { data: routes } = await supabase
    .from('alert_routes')
    .select('*')
    .eq('is_active', true);

  if (!routes || routes.length === 0) {
    // Fallback to default webhook from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('google_chat_webhook_url')
      .limit(1)
      .single();
    if (settings?.google_chat_webhook_url) {
      return [{
        id: 'default',
        name: 'Default',
        webhook_url: settings.google_chat_webhook_url,
        stage: null,
        team_id: null,
        team_ids: null,
        alert_level: null,
        lead_type: null,
        sla_override_minutes: null,
        is_active: true,
      }];
    }
    return [];
  }

  const matched: AlertRoute[] = [];

  for (const route of routes as AlertRoute[]) {
    let matches = true;

    // Check stage filter
    if (route.stage && route.stage !== lead.stage) matches = false;

    // Check team filter (supports both team_ids array and legacy team_id)
    const routeTeams = route.team_ids || (route.team_id ? [route.team_id] : null);
    if (routeTeams && routeTeams.length > 0 && (!lead.team_id || !routeTeams.includes(lead.team_id))) matches = false;

    // Check alert level filter
    if (route.alert_level && route.alert_level !== alertLevel) matches = false;

    // Check lead type filter
    if (route.lead_type && route.lead_type !== lead.lead_type) matches = false;

    if (matches) matched.push(route);
  }

  // If routes exist but none matched, fall back to default
  if (matched.length === 0) {
    const { data: settings } = await supabase
      .from('settings')
      .select('google_chat_webhook_url')
      .limit(1)
      .single();
    if (settings?.google_chat_webhook_url) {
      return [{
        id: 'default',
        name: 'Default',
        webhook_url: settings.google_chat_webhook_url,
        stage: null,
        team_id: null,
        team_ids: null,
        alert_level: null,
        lead_type: null,
        sla_override_minutes: null,
        is_active: true,
      }];
    }
  }

  return matched;
}

function buildAlertCard(lead: Lead) {
  const rule = SLA_RULES[lead.stage as Stage];
  if (!rule) return null;

  const idleTime = getIdleTime(lead.stage_entered_at);
  const action = STAGE_ACTIONS[lead.stage as Stage] || 'Review required.';

  return {
    cardsV2: [
      {
        cardId: `sla-alert-${lead.odoo_lead_id}`,
        card: {
          header: {
            title: `⚠️ SLA Breach: ${lead.lead_name}`,
            subtitle: `Stage: ${lead.stage} | Idle: ${idleTime}`,
          },
          sections: [
            {
              header: `🔴 ${rule.label} ALERT`,
              widgets: [
                { decoratedText: { topLabel: 'Lead', text: lead.lead_name } },
                { decoratedText: { topLabel: 'Company', text: lead.partner_name || 'N/A' } },
                { decoratedText: { topLabel: 'Salesperson', text: lead.salesperson || 'Unassigned' } },
                { decoratedText: { topLabel: 'Stage', text: lead.stage } },
                { decoratedText: { topLabel: 'Idle Time', text: idleTime } },
                { decoratedText: { topLabel: 'Max Allowed', text: getMaxIdleLabel(lead.stage as Stage) } },
              ],
            },
            {
              header: '📋 Action Required',
              widgets: [
                { textParagraph: { text: `<b>${action}</b>` } },
                { textParagraph: { text: `<b>Alert sent to:</b> ${rule.recipients.join(', ')}` } },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Open in Odoo',
                        onClick: {
                          openLink: {
                            url: `https://erp.zumasales.com/web#id=${lead.odoo_lead_id}&model=crm.lead&view_type=form`,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

/**
 * Send alert to a single webhook URL.
 */
export async function sendGoogleChatAlert(
  lead: Lead,
  webhookUrl: string,
): Promise<Record<string, unknown> | null> {
  const card = buildAlertCard(lead);
  if (!card) return null;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!response.ok) {
      console.error('Google Chat webhook failed:', response.status, await response.text());
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.error('Google Chat webhook error:', error);
    return null;
  }
}

/**
 * Send alerts to all matching routes for a lead.
 * Each route can have its own SLA override — only sends if that route's SLA is breached.
 */
export async function sendRoutedAlerts(
  lead: Lead,
): Promise<{ sent: number; urls: string[] }> {
  const routes = await getMatchingRoutes(lead);
  let sent = 0;
  const urls: string[] = [];

  for (const route of routes) {
    // If route has SLA override, check against that threshold
    if (route.sla_override_minutes) {
      const { checkSLA: checkSLAFn } = await import('./sla');
      const status = checkSLAFn(lead, route.sla_override_minutes);
      if (status !== 'breached') continue; // Not breached per this route's SLA
    }

    const result = await sendGoogleChatAlert(lead, route.webhook_url);
    if (result) {
      sent++;
      urls.push(route.webhook_url);
    }
  }

  return { sent, urls: [...new Set(urls)] };
}
