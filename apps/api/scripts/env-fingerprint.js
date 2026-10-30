#!/usr/bin/env node
/**
 * Prints NON-SECRET fingerprints of the settings that must match between two
 * OTLOB API instances (e.g. local vs Railway) for failover to be safe:
 *
 *   - which database they talk to (host / db name / Supabase project ref — never
 *     the user, password or full URL)
 *   - whether they sign and verify JWTs with the same secrets (a truncated
 *     SHA-256 of each secret: one-way, 12 hex chars)
 *   - which Supabase project they use for Storage
 *
 * Run it in BOTH environments and compare the output line by line:
 *   local:    npm run env:fingerprint --workspace=@otlob/api
 *   Railway:  railway run npm run env:fingerprint --workspace=@otlob/api
 *             (or run `node scripts/env-fingerprint.js` in a Railway shell)
 *
 * If any line differs, the two APIs are NOT interchangeable. Do not enable
 * failover until they match.
 */
const crypto = require('node:crypto');

try {
  // Node >= 20.12 / 22: loads ./.env into process.env without a dependency.
  process.loadEnvFile();
} catch {
  /* no .env file (e.g. on Railway, where variables are injected) — fine */
}

const fp = (value) =>
  value ? crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12) : 'UNSET';

function dbInfo(name) {
  const raw = process.env[name];
  if (!raw) return 'UNSET';
  try {
    const u = new URL(raw);
    const user = decodeURIComponent(u.username || '');
    // Supabase pooler usernames look like "postgres.<project-ref>".
    const ref = user.includes('.') ? user.split('.').pop() : '(n/a)';
    return `host=${u.hostname} port=${u.port || '(default)'} db=${u.pathname.replace('/', '')} supabaseProjectRef=${ref}`;
  } catch {
    return 'UNPARSEABLE';
  }
}

const host = (name) => {
  try {
    return new URL(process.env[name]).hostname;
  } catch {
    return process.env[name] ? 'UNPARSEABLE' : 'UNSET';
  }
};

const lines = [
  ['DATABASE_URL', dbInfo('DATABASE_URL')],
  ['DIRECT_URL', dbInfo('DIRECT_URL')],
  ['SUPABASE_URL host', host('SUPABASE_URL')],
  ['JWT_ACCESS_SECRET fp', fp(process.env.JWT_ACCESS_SECRET)],
  ['JWT_REFRESH_SECRET fp', fp(process.env.JWT_REFRESH_SECRET)],
  ['JWT_ACCESS_EXPIRES_IN', process.env.JWT_ACCESS_EXPIRES_IN || '(unset -> code default)'],
  ['JWT_REFRESH_EXPIRES_IN', process.env.JWT_REFRESH_EXPIRES_IN || '(unset -> code default)'],
  ['SUPABASE_SERVICE_ROLE_KEY fp', fp(process.env.SUPABASE_SERVICE_ROLE_KEY)],
  ['AUTO_DELIVER_SCAN_ENABLED', process.env.AUTO_DELIVER_SCAN_ENABLED || '(unset -> enabled)'],
  ['REDIS_URL host', host('REDIS_URL')],
];

const width = Math.max(...lines.map(([k]) => k.length));
console.log('OTLOB API environment fingerprint (non-secret)\n');
for (const [k, v] of lines) console.log(`${k.padEnd(width)}  ${v}`);
console.log(
  '\nCompare with the other environment. DATABASE_URL project ref, SUPABASE_URL host and every "fp" line must be identical;\n' +
    'REDIS_URL / AUTO_DELIVER_SCAN_ENABLED are expected to differ (see docs/local-and-railway.md).',
);
