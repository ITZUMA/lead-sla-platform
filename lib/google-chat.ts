import type { Lead, Stage } from './types';
import { SLA_RULES, getIdleTime } from './sla';

const ALERT_COLORS: Record<string, string> = {
  highest: '#FF0000',
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
};

const STAGE_ACTIONS: Record<Stage, string> = {
  'New': 'Kanban state turns Red. Immediate attention required!',
  'Contact Attempt': 'Kanban state turns Red. Manager alerted. Consider Nurture.',
  'Qualifying': 'Flag for pipeline review.',
  'Sourcing Product': 'Escalation alert. If unit can\'t be found, move to Nurture or Lost (Availability).',
  'Quoted / Finance': 'Flag for follow-up review. Quote going cold?',
  'Committed Sale': 'Red flag. Money should have arrived. Customer backing out?',
};

interface ChatCard {
  cardsV2: Array<{
    cardId: string;
    card: {
      header: {
        title: string;
        subtitle: string;
        imageUrl?: string;
        imageType?: string;
      };
      sections: Array<{
        header?: string;
        widgets: Array<Record<string, unknown>>;
      }>;
    };
  }>;
}

export async function sendGoogleChatAlert(
  lead: Lead,
  webhookUrl: string,
): Promise<Record<string, unknown> | null> {
  const rule = SLA_RULES[lead.stage as Stage];
  if (!rule) return null;

  const idleTime = getIdleTime(lead.stage_entered_at);
  const action = STAGE_ACTIONS[lead.stage as Stage] || 'Review required.';

  const card: ChatCard = {
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
                {
                  decoratedText: {
                    topLabel: 'Lead',
                    text: lead.lead_name,
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Company',
                    text: lead.partner_name || 'N/A',
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Salesperson',
                    text: lead.salesperson || 'Unassigned',
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Stage',
                    text: lead.stage,
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Idle Time',
                    text: idleTime,
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Max Allowed',
                    text: rule.max_idle_ms < 86400000
                      ? `${rule.max_idle_ms / 3600000} hour(s)`
                      : `${rule.max_idle_ms / 86400000} day(s)`,
                  },
                },
              ],
            },
            {
              header: '📋 Action Required',
              widgets: [
                {
                  textParagraph: {
                    text: `<b>${action}</b>`,
                  },
                },
                {
                  textParagraph: {
                    text: `<b>Alert sent to:</b> ${rule.recipients.join(', ')}`,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

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
