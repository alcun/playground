import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static output. PUBLIC_SITE_URL sets canonical and Open Graph URLs; it is optional.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || undefined,
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});