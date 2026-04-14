import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkSLA } from '@/lib/sla';
import { sendGoogleChatAlert } from '@/lib/google-chat';
import { getStageNameFromId, getSlaStage } from '@/lib/odoo-stages';
import type { OdooWebhookPayload, Lead } from '@/lib/types';

export async function POST(request: Request) {
  try {
    // Verify token from URL query param
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (token !== process.env.WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: OdooWebhookPayload = await request.json();

    // Only process leads from Sales Team ID 1 and 6
    const ALLOWED_TEAM_IDS = [1, 6];
    const teamId = typeof payload.team_id === 'number' ? payload.team_id : null;
    if (teamId !== null && !ALLOWED_TEAM_IDS.includes(teamId)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Team ${teamId} not monitored for SLA`,
      });
    }

    // Handle both Odoo native format and legacy format
    const leadId = payload.id || payload.lead_id;
    const leadName = payload.name || payload.lead_name || `Lead #${leadId}`;
    const partnerName = (payload.contact_name !== false && payload.contact_name) || payload.partner_name || '';
    const stageEnteredAt = payload.date_last_stage_update || payload.last_stage_update || payload.stage_entered_at;

    // Resolve stage name from stage_id or use direct stage name
    let odooStageName: string;
    if (payload.stage_id) {
      odooStageName = getStageNameFromId(payload.stage_id);
    } else if (payload.stage) {
      odooStageName = payload.stage;
    } else {
      return NextResponse.json({ error: 'Missing stage_id or stage' }, { status: 400 });
    }

    // Map to SLA stage (may be null if not SLA-monitored)
    const slaStage = getSlaStage(odooStageName);

    // Validate required fields
    if (!leadId || !stageEnteredAt) {
      return NextResponse.json(
        { error: 'Missing required fields: id, date_last_stage_update' },
        { status: 400 },
      );
    }

    // Check SLA status (only if stage is SLA-monitored)
    const slaStatus = slaStage
      ? checkSLA({ stage: slaStage, stage_entered_at: stageEnteredAt })
      : 'ok';

    // Use the SLA stage name for display, or the raw Odoo stage name
    const displayStage = slaStage || odooStageName;

    // Upsert lead
    const { data: lead, error } = await supabase
      .from('leads')
      .upsert(
        {
          odoo_lead_id: leadId,
          lead_name: leadName,
          partner_name: partnerName,
          salesperson: payload.salesperson || (payload.user_id ? `User ${payload.user_id}` : ''),
          salesperson_email: payload.salesperson_email || '',
          stage: displayStage,
          stage_entered_at: stageEnteredAt,
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
      return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 });
    }

    // If SLA is breached, send alert
    if (slaStatus === 'breached' && lead) {
      await sendAlertIfNeeded(lead as Lead);
    }

    return NextResponse.json({
      success: true,
      lead_id: lead?.id,
      odoo_stage: odooStageName,
      sla_stage: slaStage,
      sla_status: slaStatus,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
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
