#!/usr/bin/env node
/**
 * Prints this computer's LAN address(es) so you can point a PHYSICAL phone at
 * your local OTLOB API. Usually you do NOT need this: in development the app
 * derives the local API from the Metro dev server's host automatically, so a
 * changed IP just works after reloading. Use it to pin an address explicitly
 * (EXPO_PUBLIC_LOCAL_API_URL) or to double-check what your phone should reach.
 *
 *   npm run dev:lan-ip
 */
const os = require('node:os');

const PORT = process.env.PORT || 4000;

// Skip loopback, link-local (169.254.x.x) and the usual virtual adapters.
const VIRTUAL = /docker|veth|vethernet|vmnet|virtualbox|vbox|utun|awdl|llw|bridge|br-|wsl|hyper-v|tailscale|zerotier/i;

const rank = (ip) =>
  ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;

const found = [];
for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
    found.push({ name, address: a.address, virtual: VIRTUAL.test(name) });
  }
}
found.sort((a, b) => Number(a.virtual) - Number(b.virtual) || rank(a.address) - rank(b.address));

if (found.length === 0) {
  console.log('No LAN IPv4 address found. Are you connected to Wi-Fi / Ethernet?');
  process.exit(1);
}

console.log('LAN addresses of this computer (API port ' + PORT + '):\n');
found.forEach((f, i) =>
  console.log(`  ${f.address.padEnd(16)} ${f.name}${f.virtual ? '  (virtual adapter — probably not this one)' : i === 0 ? '  <- most likely' : ''}`),
);

const best = found[0].address;
console.log(`
Pin it for the mobile app (optional) in apps/app/.env.local, then restart Metro with \`npx expo start -c\`:

  EXPO_PUBLIC_LOCAL_API_URL=http://${best}:${PORT}/api

Your phone and computer must be on the SAME network. The local API must listen on all
interfaces: set HOST=0.0.0.0 in apps/api/.env. Quick reachability test from the phone's browser:

  http://${best}:${PORT}/api/health/live

Windows only — allow the port through the firewall (PowerShell, run as Administrator):

  New-NetFirewallRule -DisplayName "OTLOB API ${PORT}" -Direction Inbound -Protocol TCP -LocalPort ${PORT} -Action Allow -Profile Private
`);
