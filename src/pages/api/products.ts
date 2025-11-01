import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE;
const maxBytes = Number(import.meta.env.MAX_UPLOAD_BYTES || process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
const allowedAdmins = (import.meta.env.ALLOWED_ADMIN_EMAILS || process.env.ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const supabase = createClient(supabaseUrl!, serviceKey!);

function isValidPhone(s: string) {
  // Allow empty (will fall back to DEFAULT_WA_NUMBER on frontend).
  // If provided, must be an Indian number: 10 digits with country code 91 -> total 12 digits after normalization.
  const digits = s.replace(/\D/g, '');
  return digits.length === 0 || /^91\d{10}$/.test(digits) || /^\d{10}$/.test(digits);
}
function isValidPrice(s: string) {
  return /^\d+(\.\d{1,2})?$/.test(s) && Number(s) > 0;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const accessToken = auth.replace('Bearer ', '').trim();
    const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
    const email = userData?.user?.email || '';
    const appRole = (userData?.user?.app_metadata as any)?.role;
    const isAdmin = (!!email && allowedAdmins.includes(email)) || appRole === 'admin';
    if (userErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    const price = String(form.get('price') || '').trim();
    // Restrict category to enum values (server-side enforcement)
    const rawCategory = String(form.get('category') || '').trim().toLowerCase();
    const allowedCategories = ['fashion', 'beauty', 'footwear'];
    const category = allowedCategories.includes(rawCategory) ? rawCategory : '';
    const whatsapp_number = String(form.get('whatsapp_number') || '').trim();
    const images = form.getAll('image_uploads') as File[];

    if (!name) return new Response(JSON.stringify({ error: 'name is required' }), { status: 400 });
    if (!isValidPrice(price)) return new Response(JSON.stringify({ error: 'price must be numeric > 0 (2dp max)' }), { status: 400 });
    if (whatsapp_number && !isValidPhone(whatsapp_number)) {
      return new Response(
        JSON.stringify({ error: 'invalid whatsapp number: must be Indian 10-digit (+91)' }),
        { status: 400 }
      );
    }
    if (!category) {
      return new Response(JSON.stringify({ error: 'invalid category' }), { status: 400 });
    }
    if (!images || images.length < 2 || images.length > 5) {
      return new Response(JSON.stringify({ error: '2-5 images required' }), { status: 400 });
    }
    
    // Validate all images
    for (const image of images) {
      if (image.size > maxBytes) return new Response(JSON.stringify({ error: 'file too large' }), { status: 413 });
      if (!['image/jpeg', 'image/png'].includes(image.type)) return new Response(JSON.stringify({ error: 'only JPG/PNG allowed' }), { status: 415 });
    }

    // Upload all images to storage
    const uploadedImages: { url: string; order: number }[] = [];
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const timestamp = Date.now();
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const ext = image.type === 'image/png' ? 'png' : 'jpg';
      const path = `${safeName}-${timestamp}-${i + 1}.${ext}`;

      const arrayBuffer = await image.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('products').upload(path, new Uint8Array(arrayBuffer), {
        contentType: image.type,
        upsert: false,
        cacheControl: '31536000',
      });
      if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

      const { data: urlData } = supabase.storage.from('products').getPublicUrl(path);
      uploadedImages.push({ url: urlData.publicUrl, order: i + 1 });
    }
    
    // Use first image as primary image_url for backward compatibility
    const image_url = uploadedImages[0]?.url;

    // Normalize WhatsApp number to India (store digits-only starting with 91)
    const waDigitsOnly = whatsapp_number.replace(/\D/g, '');
    const waNormalized = waDigitsOnly
      ? (waDigitsOnly.startsWith('91') ? waDigitsOnly : '91' + waDigitsOnly)
      : null;
    const waFinal = waNormalized && /^91\d{10}$/.test(waNormalized) ? waNormalized : null;

    const { data: inserted, error: insErr } = await supabase
      .from('products')
      .insert({ name, description, price: Number(price), category, image_url, whatsapp_number: waFinal, active: true })
      .select('id')
      .single();
    if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });

    // Insert all images into product_images table
    const imageInserts = uploadedImages.map(img => ({
      product_id: inserted.id,
      image_url: img.url,
      display_order: img.order,
      alt_text: `${name} - Image ${img.order}`
    }));

    const { error: imagesErr } = await supabase
      .from('product_images')
      .insert(imageInserts);

    if (imagesErr) {
      // If image insertion fails, we should clean up the product
      await supabase.from('products').delete().eq('id', inserted.id);
      return new Response(JSON.stringify({ error: imagesErr.message }), { status: 500 });
    }

    // Call Supabase Edge Function to relay deploy hook & log metrics
    const edgeUrl = `${supabaseUrl}/functions/v1/deploy-hook`;
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ op: 'insert', product_id: inserted.id }),
    });
    if (!edgeRes.ok) {
      const errText = await edgeRes.text();
      return new Response(JSON.stringify({ error: `edge function failed: ${errText}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || 'unknown error' }), { status: 500 });
  }
};