import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

export const GET: APIRoute = async ({ request }) => {
  try {
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'service key missing' }), { status: 500 });
    }
    const reqUrl = new URL(request.url);
    const days = Math.max(1, Math.min(365, Number(reqUrl.searchParams.get('days') || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const productId = reqUrl.searchParams.get('product_id');

    let query = supabase
      .from('click_events_daily_v')
      .select('day, product_id, open_mode, app_opened_guess, clicks')
      .gte('day', since.toISOString().slice(0, 10));

    if (productId) {
      query = query.eq('product_id', Number(productId));
    }

    const { data, error } = await query.order('day', { ascending: true }).limit(5000);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Group by product_id for convenience
    const grouped: Record<string, any[]> = {};
    for (const row of data || []) {
      const key = String(row.product_id);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    // Public analytics summary can be cached at the edge for 12h, SWR 60s
    return new Response(JSON.stringify({ days, since: since.toISOString().slice(0, 10), products: grouped }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=43200, stale-while-revalidate=60' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || 'unknown error' }), { status: 500 });
  }
};