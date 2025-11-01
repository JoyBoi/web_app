/// <reference types="astro/client" />

// Consolidated environment typing
interface ImportMetaEnv {
  // Public (exposed to client)
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
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