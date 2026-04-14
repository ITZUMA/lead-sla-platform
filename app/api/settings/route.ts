import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ google_chat_webhook_url: '', sla_rules: {}, alert_recipients: {} });
  }
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await request.json();

  // Get existing settings row
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .limit(1)
    .single();

  if (!existing) {
    // Create settings if none exist
    const { data, error } = await supabase
      .from('settings')
      .insert({
        google_chat_webhook_url: body.google_chat_webhook_url || '',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('settings')
    .update({
      google_chat_webhook_url: body.google_chat_webhook_url,
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
