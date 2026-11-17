import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Worker tests run inside the Workers runtime, against a local D1 database.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            LIVEKIT_URL: 'wss://test-project.livekit.cloud',
            LIVEKIT_API_KEY: 'APItestkey',
            LIVEKIT_API_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
            BACKEND_API_KEY: 'test-backend-key',
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
