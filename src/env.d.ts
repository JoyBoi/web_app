/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL?: string; // e.g. 'https://byas-store.example.com'
  readonly PUBLIC_DEFAULT_WA_NUMBER?: string;
  // Brand accent palette; matches tailwind brand data attribute
  readonly PUBLIC_BRAND?: 'indigo' | 'teal' | 'rose';

  // Server-only secrets (never exposed client-side)
  readonly SUPABASE_SERVICE_ROLE?: string;
  readonly VERCEL_DEPLOY_HOOK?: string;
  readonly ALLOWED_ADMIN_EMAILS?: string; // comma-separated emails
  readonly MAX_UPLOAD_BYTES?: string; // string in env; cast to Number at runtime

  // Used by scripts/create-temp-admin.mjs if applicable
  readonly TEMP_ADMIN_EMAIL?: string;
  readonly TEMP_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Consolidated environment typing
interface ImportMetaEnv {
  // Public (exposed to client)
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly DEFAULT_WA_NUMBER?: string; // e.g. '+91XXXXXXXXXX' or '91XXXXXXXXXX'
  readonly VERCEL_DEPLOY_HOOK?: string;
  readonly ALLOWED_ADMIN_EMAILS?: string;
  readonly MAX_UPLOAD_BYTES?: string;

  // Server-side only (not exposed to client)
  readonly SUPABASE_SERVICE_ROLE?: string;
  readonly SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}