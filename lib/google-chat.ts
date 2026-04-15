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
  team_id: number | null;
  alert_level: string | null;
  is_active: boolean;
}

/**
 * Get all matching webhook URLs for a lead based on routing rules.
 * Falls back to the default webhook URL from settings if no routes match.
 */
export async function getMatchingWebhookUrls(
  lead: Lead & { team_id?: number | null },
): Promise<string[]> {
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
    return settings?.google_chat_webhook_url ? [settings.google_chat_webhook_url] : [];
  }

  const matched: string[] = [];

  for (const route of routes as AlertRoute[]) {
    let matches = true;

    // Check stage filter
    if (route.stage && route.stage !== lead.stage) {
      matches = false;
    }

    // Check team filter
    if (route.team_id && route.team_id !== (lead as Record<string, unknown>).team_id) {
      matches = false;
    }

    // Check alert level filter
    if (route.alert_level && route.alert_level !== alertLevel) {
      matches = false;
    }

    if (matches) {
      matched.push(route.webhook_url);
    }
  }

  // If routes exist but none matched, fall back to default
  if (matched.length === 0) {
    const { data: settings } = await supabase
      .from('settings')
      .select('google_chat_webhook_url')
      .limit(1)
      .single();
    return settings?.google_chat_webhook_url ? [settings.google_chat_webhook_url] : [];
  }

  return [...new Set(matched)]; // deduplicate
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
 */
export async function sendRoutedAlerts(
  lead: Lead & { team_id?: number | null },
): Promise<{ sent: number; urls: string[] }> {
  const urls = await getMatchingWebhookUrls(lead);
  let sent = 0;

  for (const url of urls) {
    const result = await sendGoogleChatAlert(lead, url);
    if (result) sent++;
  }

  return { sent, urls };
}
