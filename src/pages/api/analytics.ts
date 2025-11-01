import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE;
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

type Payload = {
  action: 'whatsapp_click';
  product_id: number;
  ua?: string;
  path?: string;
  open_mode?: 'api_mobile' | 'web_desktop';
  app_opened_guess?: 'likely' | 'unlikely';
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Payload | null = null;
    if (contentType.includes('application/json')) {
      body = (await request.json()) as Payload;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const fd = await request.formData();
      body = {
        action: fd.get('action') as any,
        product_id: Number(fd.get('product_id') || 0),
        ua: String(fd.get('ua') || ''),
        path: String(fd.get('path') || ''),
      };
    } else {
      return new Response(JSON.stringify({ error: 'unsupported content type' }), { status: 415 });
    }

    if (!body || body.action !== 'whatsapp_click' || !Number.isFinite(body.product_id)) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400 });
    }

    if (!supabase) {
      // In dev without service role, just accept and no-op
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    const ua = body.ua || request.headers.get('user-agent') || '';
    const path = body.path || url.pathname;
    const open_mode = body.open_mode || null;
    const app_opened_guess = body.app_opened_guess || null;
    const insertRow: Record<string, any> = { action: 'whatsapp_click', product_id: body.product_id, ua, path };
    if (open_mode) insertRow.open_mode = open_mode;
    if (app_opened_guess) insertRow.app_opened_guess = app_opened_guess;
    const { error } = await supabase
      .from('click_events')
      .insert(insertRow);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || 'unknown error' }), { status: 500 });
  }
};