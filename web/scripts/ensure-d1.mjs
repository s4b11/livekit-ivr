// Make sure the D1 database named in wrangler.jsonc exists, and write its ID
// into the config. Run by the deploy workflow before migrating and deploying,
// so the database never has to be created or configured by hand.
//
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/ensure-d1.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = new URL('../wrangler.jsonc', import.meta.url);
const PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

const config = readFileSync(CONFIG, 'utf8');
const name = config.match(/"database_name":\s*"([^"]+)"/)?.[1];
if (!name || !config.includes(PLACEHOLDER)) {
  throw new Error('wrangler.jsonc must name a D1 database and keep the placeholder database_id');
}

function wrangler(...args) {
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function findDatabaseId() {
  const output = wrangler('d1', 'list', '--json');
  const databases = JSON.parse(output.slice(output.indexOf('[')));
  return databases.find((database) => database.name === name)?.uuid;
}

let id = findDatabaseId();
if (!id) {
  console.log(`Creating D1 database "${name}"`);
  wrangler('d1', 'create', name);
  id = findDatabaseId();
}
if (!id) throw new Error(`Could not find or create D1 database "${name}"`);

writeFileSync(CONFIG, config.replace(PLACEHOLDER, id));
console.log(`Using D1 database "${name}" (${id})`);
