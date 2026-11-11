// Bindings and variables come from `wrangler types` (worker-configuration.d.ts).
// Secrets are not in wrangler.jsonc, so they are declared here.
interface WorkerSecrets {
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  /** Shared secret for the private endpoints. They are closed when it is unset. */
  BACKEND_API_KEY?: string;
}

interface Env extends WorkerSecrets {}

declare namespace Cloudflare {
  interface Env extends WorkerSecrets {}
}
