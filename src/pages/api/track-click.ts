import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// Simple in-memory rate limit (best-effort; per-process) to avoid abuse in admin routes
const recent: Map<string, number> = new Map();
const WINDOW_MS = 5_000; // 5s window

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
    }

    // Handle sendBeacon payload (text/plain) or JSON
    let payload: any = null;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json().catch(() => null);
    } else {
      const txt = await request.text();
      try { payload = JSON.parse(txt); } catch { payload = null; }
    }

    const product_id = Number(payload?.product_id);
    const path = String(payload?.path || '');
    if (!product_id || product_id < 1 || !path || !path.startsWith('/')) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // Naive rate limit by IP
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
    const now = Date.now();
    const last = recent.get(ip) || 0;
    if (now - last < WINDOW_MS) {
      return new Response(null, { status: 204 });
    }
    recent.set(ip, now);

    const user_agent = request.headers.get('user-agent') || '';

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { error } = await admin.from('click_events').insert({ product_id, path, user_agent });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Beacon-friendly response
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500 });
  }
};

export const GET: APIRoute = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });