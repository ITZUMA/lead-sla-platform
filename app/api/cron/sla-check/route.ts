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
      // Check each matching route independently for SLA breaches
      const routes = await getMatchingRoutes(lead);

      // Update lead SLA status based on the strictest matching route
      let worstStatus: 'ok' | 'warning' | 'breached' = 'ok';
      for (const route of routes) {
        const s = checkSLA(lead, route.sla_override_minutes);
        if (s === 'breached') { worstStatus = 'breached'; break; }
        if (s === 'warning') worstStatus = 'warning';
      }
      if (worstStatus !== lead.sla_status) {
        await supabase
          .from('leads')
          .update({
            sla_status: worstStatus,
            sla_breached_at: worstStatus === 'breached' ? new Date().toISOString() : lead.sla_breached_at,
          })
          .eq('id', lead.id);
        statusUpdated++;
      }

      for (const route of routes) {
        const status = checkSLA(lead, route.sla_override_minutes);
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

        if (existingAlert) continue;

        const chatResponse = await sendGoogleChatAlert(
          { ...lead, sla_status: 'breached' },
          route,
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
