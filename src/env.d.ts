/// <reference types="astro/client" />

// Consolidated environment typing
interface ImportMetaEnv {
  // Public (exposed in client bundle)
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL?: string; // e.g. 'https://byas-store.example.com'
  readonly PUBLIC_DEFAULT_WA_NUMBER?: string;
  readonly PUBLIC_BRAND?: 'indigo' | 'teal' | 'rose';

  // Server-side only (never exposed to client)
  readonly SUPABASE_SERVICE_ROLE?: string;
  readonly VERCEL_DEPLOY_HOOK?: string;
  readonly ALLOWED_ADMIN_EMAILS?: string; // comma-separated emails
  readonly MAX_UPLOAD_BYTES?: string; // string in env; cast to Number at runtime
  readonly TEMP_ADMIN_EMAIL?: string;
  readonly TEMP_ADMIN_PASSWORD?: string;
  readonly DEFAULT_WA_NUMBER?: string; // server fallback number for scripts/utils
  readonly SUPABASE_URL?: string; // optional: used by scripts
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}