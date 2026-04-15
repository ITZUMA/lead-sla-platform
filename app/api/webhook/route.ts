import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkSLA } from '@/lib/sla';
import { getMatchingRoutes, sendGoogleChatAlert } from '@/lib/google-chat';
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

    // Determine lead type
    const leadType = payload.type || 'opportunity';

    // Handle both Odoo native format and legacy format
    const leadId = payload.id || payload.lead_id;
    const leadName = payload.name || payload.lead_name || `Lead #${leadId}`;
    const partnerName = (payload.contact_name !== false && payload.contact_name) || payload.partner_name || '';
    let stageEnteredAt = payload.date_last_stage_update || payload.last_stage_update || payload.stage_entered_at;

    // Check if this lead was previously a 'lead' and is now an 'opportunity'
    // If so, reset the timer to NOW (conversion resets the SLA clock)
    if (leadType === 'opportunity' && leadId) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('lead_type')
        .eq('odoo_lead_id', leadId)
        .limit(1)
        .single();

      if (existingLead && existingLead.lead_type === 'lead') {
        stageEnteredAt = new Date().toISOString(); // Reset timer
      }
    }

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
          team_id: teamId,
          lead_type: leadType,
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

    // Check each matching route for SLA breach (using route-specific overrides)
    let routeAlertsSent = 0;
    if (lead) {
      const fullLead = { ...lead, team_id: teamId, lead_type: leadType } as Lead;
      const routes = await getMatchingRoutes(fullLead);

      for (const route of routes) {
        const routeStatus = route.sla_override_minutes
          ? checkSLA(fullLead, route.sla_override_minutes)
          : slaStatus;

        if (routeStatus !== 'breached') continue;

        const alertKey = `${displayStage}:${route.id}`;
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('message', alertKey)
          .limit(1)
          .single();

        if (existingAlert) continue;

        const chatResponse = await sendGoogleChatAlert(
          { ...fullLead, sla_status: 'breached' },
          route.webhook_url,
        );

        if (chatResponse) {
          await supabase.from('alerts').insert({
            lead_id: lead.id,
            stage: displayStage,
            alert_type: 'sla_breach',
            message: alertKey,
            sent_to: `Google Chat - ${route.name}`,
            google_chat_response: chatResponse,
          });
          routeAlertsSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      lead_id: lead?.id,
      odoo_stage: odooStageName,
      sla_stage: slaStage,
      sla_status: slaStatus,
      alerts_sent: routeAlertsSent,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
}
