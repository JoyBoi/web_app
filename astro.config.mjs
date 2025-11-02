// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // Helps Astro generate absolute URLs for canonical and og:url
  site: process.env.PUBLIC_SITE_URL || undefined,
  integrations: [tailwind({ applyBaseStyles: true })],
});
