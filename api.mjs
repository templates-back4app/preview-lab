// The backend. Two settings decide whether production works, and neither of them
// is visible from the machine you built on.
//
//   ALLOWED_ORIGIN   the one origin the browser is allowed to read a reply from
//   REDIRECT_URI     where sign-in sends people back to
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const PORT = Number(process.env.API_PORT ?? 7501);
const ALLOWED = process.env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173';   // the dev server
const REDIRECT = process.env.REDIRECT_URI ?? 'http://localhost:5173/callback';
const LOG = process.env.API_LOG ?? '/tmp/preview-lab-api.log';

const ORDERS = [{ id: 1041, total: 49 }, { id: 1042, total: 12 }, { id: 1043, total: 230 }];

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const origin = req.headers.origin ?? '-';
  // the allowlist is applied here, and this is the whole of it
  const headers = { 'content-type': 'application/json' };
  if (origin === ALLOWED) headers['access-control-allow-origin'] = origin;

  let status = 404, body = JSON.stringify({ error: 'not found' });
  if (path === '/api/orders') { status = 200; body = JSON.stringify({ orders: ORDERS }); }
  if (path === '/auth/start') {
    // whatever it was told at deploy time, right or wrong
    res.writeHead(302, { location: REDIRECT });
    appendFileSync(LOG, `302 ${path} origin=${origin} -> ${REDIRECT}\n`);
    return res.end();
  }
  appendFileSync(LOG, `${status} ${path} origin=${origin} cors=${headers['access-control-allow-origin'] ?? 'NOT SENT'}\n`);
  res.writeHead(status, headers);
  res.end(body);
}).listen(PORT, '127.0.0.1', () => console.error(`api up on ${PORT}`));
