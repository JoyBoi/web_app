// Temporary admin seeding script.
// Usage:
// 1) Set env: SUPABASE_URL, SUPABASE_SERVICE_ROLE, TEMP_ADMIN_EMAIL, TEMP_ADMIN_PASSWORD
// 2) npm run seed:admin
// NOTE: This uses the Service Role key. Do NOT expose it to the client.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const email = process.env.TEMP_ADMIN_EMAIL;
const password = process.env.TEMP_ADMIN_PASSWORD;

if (!url || !serviceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set TEMP_ADMIN_EMAIL and TEMP_ADMIN_PASSWORD in env');
  process.exit(1);
}

const supabase = createClient(url, serviceRole);

try {
  const { data: found, error: getErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (getErr) throw getErr;
  const exists = (found?.users || []).some((u) => u.email === email);
  if (exists) {
    console.log(`User already exists: ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'admin', seeded_at: new Date().toISOString() },
    });
    if (error) throw error;
    console.log(`Created temp admin user: ${email} (id=${data.user?.id || 'unknown'})`);
  }

  console.log('\nNext steps:');
  console.log('- Ensure ALLOWED_ADMIN_EMAILS includes this email so /api/products authorizes it.');
  console.log(`  ALLOWED_ADMIN_EMAILS="${email}"`);
  console.log('- Start dev server and sign in on /admin with the temp credentials.');
  process.exit(0);
} catch (e) {
  console.error('Failed to seed admin user:', e?.message || e);
  process.exit(1);
}