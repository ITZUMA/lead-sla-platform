import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkSLA } from '@/lib/sla';
import { sendRoutedAlerts } from '@/lib/google-chat';
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

    for (const lead of leads as (Lead & { team_id?: number | null })[]) {
      const newStatus = checkSLA(lead);

      // Update status if changed
      if (newStatus !== lead.sla_status) {
        await supabase
          .from('leads')
          .update({
            sla_status: newStatus,
            sla_breached_at: newStatus === 'breached' ? new Date().toISOString() : lead.sla_breached_at,
          })
          .eq('id', lead.id);
        statusUpdated++;
      }

      // Send alert if newly breached
      if (newStatus === 'breached' && lead.sla_status !== 'breached') {
        // Check for existing alert in this stage
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('stage', lead.stage)
          .limit(1)
          .single();

        if (!existingAlert) {
          const { sent } = await sendRoutedAlerts({ ...lead, sla_status: newStatus });

          if (sent > 0) {
            await supabase.from('alerts').insert({
              lead_id: lead.id,
              stage: lead.stage,
              alert_type: 'sla_breach',
              message: `SLA breached for "${lead.lead_name}" in stage "${lead.stage}"`,
              sent_to: `Google Chat (${sent} space${sent > 1 ? 's' : ''})`,
              google_chat_response: { sent },
            });

            alertsSent++;
          }
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
