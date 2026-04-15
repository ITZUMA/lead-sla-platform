import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkSLA } from '@/lib/sla';
import { getMatchingRoutes, sendGoogleChatAlert } from '@/lib/google-chat';
import type { Lead } from '@/lib/types';

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch leads:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: 'No active leads', checked: 0 });
    }

    let alertsSent = 0;
    let statusUpdated = 0;

    for (const lead of leads as Lead[]) {
      // Update default SLA status
      const defaultStatus = checkSLA(lead);
      if (defaultStatus !== lead.sla_status) {
        await supabase
          .from('leads')
          .update({
            sla_status: defaultStatus,
            sla_breached_at: defaultStatus === 'breached' ? new Date().toISOString() : lead.sla_breached_at,
          })
          .eq('id', lead.id);
        statusUpdated++;
      }

      // Check each matching route independently for SLA breaches
      const routes = await getMatchingRoutes(lead);

      for (const route of routes) {
        // Determine which SLA to use: route override or default
        const slaMinutes = route.sla_override_minutes;
        const status = slaMinutes
          ? checkSLA(lead, slaMinutes)
          : defaultStatus;

        if (status !== 'breached') continue;

        // Check if we already sent an alert for this lead + stage + route
        const alertKey = `${lead.stage}:${route.id}`;
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('message', alertKey)
          .limit(1)
          .single();

        if (existingAlert) continue; // Already alerted for this route

        const chatResponse = await sendGoogleChatAlert(
          { ...lead, sla_status: 'breached' },
          route.webhook_url,
        );

        if (chatResponse) {
          await supabase.from('alerts').insert({
            lead_id: lead.id,
            stage: lead.stage,
            alert_type: 'sla_breach',
            message: alertKey, // Used as dedup key: stage:routeId
            sent_to: `Google Chat - ${route.name}`,
            google_chat_response: chatResponse,
          });
          alertsSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: leads.length,
      statusUpdated,
      alertsSent,
    });
  } catch (err) {
    console.error('Cron SLA check error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
