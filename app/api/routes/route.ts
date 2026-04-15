import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ routes: [] });
  }

  const { data, error } = await supabase
    .from('alert_routes')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ routes: data });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('alert_routes')
    .insert({
      name: body.name,
      webhook_url: body.webhook_url,
      stage: body.stage || null,
      team_id: body.team_id || null,
      alert_level: body.alert_level || null,
      lead_type: body.lead_type || null,
      sla_override_minutes: body.sla_override_minutes || null,
      is_active: body.is_active !== false,
    })
    .select()
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

  if (!body.id) {
    return NextResponse.json({ error: 'Missing route id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('alert_routes')
    .update({
      name: body.name,
      webhook_url: body.webhook_url,
      stage: body.stage || null,
      team_id: body.team_id || null,
      alert_level: body.alert_level || null,
      lead_type: body.lead_type || null,
      sla_override_minutes: body.sla_override_minutes || null,
      is_active: body.is_active,
    })
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing route id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('alert_routes')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
