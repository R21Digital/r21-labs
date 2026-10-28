import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page is prerendered. Without an incremental cache OpenNext re-renders
// static routes per request, which drops build-time values and burns CPU on the
// free plan. The site has no ISR or revalidate, so a read-only build-time cache
// is enough and needs no KV or R2 binding.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
