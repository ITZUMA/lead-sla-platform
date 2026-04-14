import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ leads: [], total: 0, page: 1, limit: 50 });
  }

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get('stage');
  const status = searchParams.get('status');
  const active = searchParams.get('active');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  if (stage) query = query.eq('stage', stage);
  if (status) query = query.eq('sla_status', status);
  if (active !== null) query = query.eq('is_active', active !== 'false');

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data, total: count, page, limit });
}
