/// <reference types="astro/client" />

// Astro v6 + @astrojs/cloudflare v13 expose Worker bindings/secrets via the
// `cloudflare:workers` module (Astro.locals.runtime.env was removed). Declare
// only what this app reads; `wrangler secret put APP_PASSPHRASE` sets it in
// production and `.dev.vars` provides it locally.
declare module "cloudflare:workers" {
  export const env: {
    APP_PASSPHRASE: string;
  };
}
