/*
  Seed realistic products and images into Supabase.

  Usage:
    node scripts/seed-products.mjs [--limit=5] [--dry]

  Env:
    PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE
    DEFAULT_WA_NUMBER (fallback if whatsapp_number missing)
    MAX_UPLOAD_BYTES (default 3000000 ~ 3MB)
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const DEFAULT_WA_NUMBER = process.env.DEFAULT_WA_NUMBER || '+919999999999';
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 3000000); // 3MB default

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing env: PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args.map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const LIMIT = argMap.limit ? Number(argMap.limit) : undefined;
const DRY = Boolean(argMap.dry);

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .slice(0, 60);
}

function isValidPhone(num) {
  // allow leading + and digits only
  return /^\+?\d{10,15}$/.test(num);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function headFetch(url) {
  // Some CDNs may not support HEAD; fallback to GET
  const head = await fetch(url, { method: 'HEAD' });
  if (head.ok) return head;
  const get = await fetch(url, { method: 'GET' });
  return get;
}

async function validateImageUrl(url) {
  const res = await headFetch(url);
  if (!res.ok) throw new Error(`Image URL not reachable: ${url}`);
  const type = res.headers.get('content-type') || '';
  const len = Number(res.headers.get('content-length') || 0);
  if (!type.startsWith('image/jpeg') && !type.startsWith('image/png')) {
    throw new Error(`Invalid content-type: ${type} for ${url}`);
  }
  if (len > 0 && len > MAX_UPLOAD_BYTES) {
    throw new Error(`Image too large (${len} bytes) for ${url}. Max ${MAX_UPLOAD_BYTES}`);
  }
  return { type, len };
}

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${url}`);
  const type = res.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, type };
}

async function ensureProductImagesTable() {
  const { error } = await supabase.from('product_images').select('id').limit(1);
  if (error) {
    console.warn('product_images table not accessible via API. Ensure migration 0009_product_images.sql is applied.');
  }
}

async function seed() {
  const datasetPath = path.resolve(process.cwd(), 'scripts', 'test-products.json');
  const raw = await fs.readFile(datasetPath, 'utf-8');
  /** @type {Array<{name:string,description:string,price:number,category:string,whatsapp_number?:string,images:string[]}>} */
  const products = JSON.parse(raw);
  const items = LIMIT ? products.slice(0, LIMIT) : products;

  // Pre-validate dataset
  for (const p of items) {
    if (!p.name || typeof p.name !== 'string') throw new Error('Invalid name');
    if (typeof p.price !== 'number' || p.price <= 0) throw new Error(`Invalid price for ${p.name}`);
    if (!p.category) throw new Error(`Missing category for ${p.name}`);
    if (!p.images || p.images.length < 2 || p.images.length > 5) throw new Error(`Images count 2-5 required for ${p.name}`);
    const wa = p.whatsapp_number || DEFAULT_WA_NUMBER;
    if (!isValidPhone(wa)) throw new Error(`Invalid whatsapp_number for ${p.name}: ${wa}`);
  }

  if (DRY) {
    console.log(`[DRY RUN] Validated ${items.length} products. No writes performed.`);
    return;
  }

  await ensureProductImagesTable();

  const bucket = 'products';

  function normalizeCategory(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return 'fashion';
    if (/^(beauty|cosmetics|skincare|makeup|personal care)$/.test(s) || /(cosmetic|skin|make\s?up|care)/.test(s)) return 'beauty';
    if (/^(footwear|shoes|sneakers|sandals|boots)$/.test(s)) return 'footwear';
    return 'fashion';
  }

  function normalizeWa(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const withCc = digits.startsWith('91') ? digits : '91' + digits;
    return withCc.replace(/\D/g, '');
  }

  let successCount = 0;
  for (const p of items) {
    const wa = p.whatsapp_number || DEFAULT_WA_NUMBER;
    const waNormalized = normalizeWa(wa);
    const cat = normalizeCategory(p.category);
    const baseName = sanitizeFileName(p.name);
    console.log(`\nSeeding: ${p.name}`);

    try {
      // Skip if product with same name already exists
      const { data: existing, error: existErr } = await supabase
        .from('products')
        .select('id')
        .eq('name', p.name)
        .limit(1)
        .maybeSingle();
      if (!existErr && existing) {
        // Product already exists: backfill images if missing
        const { count: imgCount, error: imgCountErr } = await supabase
          .from('product_images')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', existing.id);

        if (imgCountErr) {
          console.warn(`Could not check images for existing product id=${existing.id}:`, imgCountErr.message);
          console.log(`Product already exists (id=${existing.id}). Skipping.`);
          successCount++;
          continue;
        }

        if ((imgCount ?? 0) > 0) {
          console.log(`Product already exists (id=${existing.id}) with ${imgCount} images. Skipping.`);
          successCount++;
          continue;
        }

        // No images yet: validate, upload, and insert product_images; also set primary image_url if missing
        const downloaded = [];
        for (let i = 0; i < p.images.length; i++) {
          const url = p.images[i];
          await validateImageUrl(url);
          const { buf, type } = await fetchImageBuffer(url);
          downloaded.push({ url, buf, type, index: i });
          await sleep(100);
        }

        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime()}`;
        const uploaded = [];
        for (const d of downloaded) {
          const ext = d.type.startsWith('image/png') ? 'png' : 'jpg';
          const objectPath = `${cat}/${baseName}/${stamp}_${d.index}.${ext}`;
          const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, d.buf, {
            contentType: d.type,
            upsert: false,
          });
          if (upErr) throw upErr;
          const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
          uploaded.push({ path: objectPath, publicUrl: data.publicUrl, index: d.index });
        }

        const imagesToInsert = uploaded.map((u) => ({
          product_id: existing.id,
          image_url: u.publicUrl,
          display_order: u.index,
          alt_text: `${p.name} image ${u.index + 1}`,
        }));

        const { error: imgInsErr } = await supabase.from('product_images').insert(imagesToInsert);
        if (imgInsErr) throw imgInsErr;

        // Update primary image_url if not set
        const firstUrl = uploaded[0]?.publicUrl || null;
        if (firstUrl) {
          const { data: prodRow, error: prodSelErr } = await supabase
            .from('products')
            .select('image_url')
            .eq('id', existing.id)
            .single();
          if (!prodSelErr && (!prodRow?.image_url || prodRow.image_url === '')) {
            const { error: updErr } = await supabase
              .from('products')
              .update({ image_url: firstUrl })
              .eq('id', existing.id);
            if (updErr) console.warn(`Failed to set primary image_url for product id=${existing.id}:`, updErr.message);
          }
        }

        console.log(`Backfilled ${uploaded.length} images for existing product (id=${existing.id}).`);
        successCount++;
        continue;
      }

      // Validate each image URL and download
      const downloaded = [];
      for (let i = 0; i < p.images.length; i++) {
        const url = p.images[i];
        await validateImageUrl(url);
        const { buf, type } = await fetchImageBuffer(url);
        downloaded.push({ url, buf, type, index: i });
        // small delay to be nice with the CDN
        await sleep(100);
      }

      // Upload images to storage with unique path
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime()}`;
      const uploaded = [];
      for (const d of downloaded) {
        const ext = d.type.startsWith('image/png') ? 'png' : 'jpg';
        const objectPath = `${cat}/${baseName}/${stamp}_${d.index}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, d.buf, {
          contentType: d.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        uploaded.push({ path: objectPath, publicUrl: data.publicUrl, index: d.index });
      }

      // Insert product
      const firstUrl = uploaded[0]?.publicUrl || null;
      const { data: inserted, error: insErr } = await supabase
        .from('products')
        .insert({
          name: p.name,
          description: p.description,
          price: p.price,
          category: cat,
          image_url: firstUrl,
          whatsapp_number: waNormalized || null,
          active: true,
        })
        .select('id')
        .single();

      if (insErr) throw insErr;

      // Insert product_images
      const imagesToInsert = uploaded.map((u) => ({
        product_id: inserted.id,
        image_url: u.publicUrl,
        display_order: u.index,
        alt_text: `${p.name} image ${u.index + 1}`,
      }));

      const { error: imgErr } = await supabase.from('product_images').insert(imagesToInsert);
      if (imgErr) throw imgErr;

      console.log(`Inserted product ${p.name} (id=${inserted.id}) with ${uploaded.length} images.`);
      successCount++;
    } catch (err) {
      console.error(`Failed to seed ${p.name}:`, err?.message || err);
      // Best-effort rollback: delete any uploaded images for this product name path
      try {
        const folderPrefix = `${p.category}/${sanitizeFileName(p.name)}`;
        const { data: listData, error: listErr } = await supabase.storage.from(bucket).list(folderPrefix, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (!listErr && Array.isArray(listData)) {
          for (const obj of listData) {
            await supabase.storage.from(bucket).remove([`${folderPrefix}/${obj.name}`]);
          }
        }
      } catch (cleanupErr) {
        console.warn('Cleanup error:', cleanupErr?.message || cleanupErr);
      }
    }
  }

  console.log(`\nSeed complete. Inserted ${successCount}/${items.length} products.`);

  // Post-insert validation summary
  const { count: productsCount, error: productsCountErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });
  const { count: imagesCount, error: imagesCountErr } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true });
  if (productsCountErr) console.warn('Products count error:', productsCountErr.message);
  if (imagesCountErr) console.warn('Product images count error:', imagesCountErr.message);
  console.log(`Products in DB: ${productsCount ?? 'unknown'}`);
  console.log(`Product images in DB: ${imagesCount ?? 'unknown'}`);
}

seed().catch((e) => {
  console.error('Seed fatal error:', e);
  process.exit(1);
});