import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ alerts: [], total: 0, page: 1, limit: 50 });
  }
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const { data, error, count } = await supabase
    .from('alerts')
    .select('*, lead:leads(lead_name, partner_name, salesperson, odoo_lead_id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data, total: count, page, limit });
}
