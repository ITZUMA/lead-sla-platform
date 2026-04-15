import type { Lead } from './types';
import { getIdleTime, formatSlaMinutes } from './sla';
import { supabase, isSupabaseConfigured } from './supabase';

export interface AlertRoute {
  id: string;
  name: string;
  webhook_url: string;
  stage: string | null;
  team_id: number | null;
  team_ids: number[] | null;
  alert_level: string | null;
  lead_type: string | null;
  sla_override_minutes: number | null;
  action_message: string | null;
  is_active: boolean;
}

/**
 * Get all matching routes for a lead based on routing rules.
 * No defaults — only explicitly configured routes fire alerts.
 */
export async function getMatchingRoutes(lead: Lead): Promise<AlertRoute[]> {
  if (!isSupabaseConfigured) return [];

  const { data: routes } = await supabase
    .from('alert_routes')
    .select('*')
    .eq('is_active', true);

  if (!routes || routes.length === 0) return [];

  const matched: AlertRoute[] = [];

  for (const route of routes as AlertRoute[]) {
    let matches = true;

    if (route.stage && route.stage !== lead.stage) matches = false;

    const routeTeams = route.team_ids || (route.team_id ? [route.team_id] : null);
    if (routeTeams && routeTeams.length > 0 && (!lead.team_id || !routeTeams.includes(lead.team_id))) matches = false;

    if (route.lead_type && route.lead_type !== lead.lead_type) matches = false;

    // alert_level filter no longer applies since we removed default rules

    if (matches) matched.push(route);
  }

  return matched;
}

function buildAlertCard(lead: Lead, route: AlertRoute) {
  const idleTime = getIdleTime(lead.stage_entered_at);
  const maxAllowed = route.sla_override_minutes
    ? formatSlaMinutes(route.sla_override_minutes)
    : 'N/A';
  const action = route.action_message || 'Review required.';

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
              widgets: [
                { decoratedText: { topLabel: 'Lead', text: lead.lead_name } },
                { decoratedText: { topLabel: 'Company', text: lead.partner_name || 'N/A' } },
                { decoratedText: { topLabel: 'Stage', text: lead.stage } },
                { decoratedText: { topLabel: 'Type', text: lead.lead_type || 'opportunity' } },
                { decoratedText: { topLabel: 'Idle Time', text: idleTime } },
                { decoratedText: { topLabel: 'Max Allowed', text: maxAllowed } },
              ],
            },
            {
              header: '📋 Action Required',
              widgets: [
                { textParagraph: { text: `<b>${action}</b>` } },
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
 * Send alert to a single webhook URL with route-specific card.
 */
export async function sendGoogleChatAlert(
  lead: Lead,
  route: AlertRoute,
): Promise<Record<string, unknown> | null> {
  const card = buildAlertCard(lead, route);

  try {
    const response = await fetch(route.webhook_url, {
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
