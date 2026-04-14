import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkSLA } from '@/lib/sla';
import { sendGoogleChatAlert } from '@/lib/google-chat';
import type { OdooWebhookPayload, Lead } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const payload: OdooWebhookPayload = await request.json();

    // Validate required fields
    if (!payload.lead_id || !payload.stage || !payload.stage_entered_at) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, stage, stage_entered_at' },
        { status: 400 },
      );
    }

    // Check SLA status immediately
    const slaStatus = checkSLA({
      stage: payload.stage,
      stage_entered_at: payload.stage_entered_at,
    });

    // Upsert lead
    const { data: lead, error } = await supabase
      .from('leads')
      .upsert(
        {
          odoo_lead_id: payload.lead_id,
          lead_name: payload.lead_name || `Lead #${payload.lead_id}`,
          partner_name: payload.partner_name || '',
          salesperson: payload.salesperson || '',
          salesperson_email: payload.salesperson_email || '',
          stage: payload.stage,
          stage_entered_at: payload.stage_entered_at,
          sla_status: slaStatus,
          sla_breached_at: slaStatus === 'breached' ? new Date().toISOString() : null,
          is_active: true,
        },
        { onConflict: 'odoo_lead_id' },
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // If SLA is breached, send alert
    if (slaStatus === 'breached' && lead) {
      await sendAlertIfNeeded(lead as Lead);
    }

    return NextResponse.json({
      success: true,
      lead_id: lead?.id,
      sla_status: slaStatus,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

async function sendAlertIfNeeded(lead: Lead) {
  // Check if we already sent an alert for this lead in this stage
  const { data: existingAlert } = await supabase
    .from('alerts')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('stage', lead.stage)
    .limit(1)
    .single();

  if (existingAlert) return; // Already alerted for this stage

  // Get webhook URL from settings
  const { data: settings } = await supabase
    .from('settings')
    .select('google_chat_webhook_url')
    .limit(1)
    .single();

  const webhookUrl = settings?.google_chat_webhook_url;
  if (!webhookUrl) {
    console.warn('No Google Chat webhook URL configured');
    return;
  }

  const chatResponse = await sendGoogleChatAlert(lead, webhookUrl);

  // Log alert
  await supabase.from('alerts').insert({
    lead_id: lead.id,
    stage: lead.stage,
    alert_type: 'sla_breach',
    message: `SLA breached for "${lead.lead_name}" in stage "${lead.stage}"`,
    sent_to: `Google Chat`,
    google_chat_response: chatResponse,
  });
}
