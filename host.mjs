// Where the built app is served from. SPA_FALLBACK decides whether a URL typed
// straight into the address bar finds anything.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PORT = Number(process.env.HOST_PORT ?? 7502);
const DIR = join(import.meta.dirname, process.env.SERVE_DIR ?? 'dist');
const FALLBACK = process.env.SPA_FALLBACK === '1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

createServer(async (req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  if (p.endsWith('/')) p += 'index.html';
  try {
    const f = join(DIR, p);
    const body = await readFile(f);
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
    return res.end(body);
  } catch {}
  if (FALLBACK && !extname(p)) {
    // every unknown path hands back the app, which then reads the url itself
    const body = await readFile(join(DIR, 'index.html'));
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    return res.end(body);
  }
  res.writeHead(404, { 'content-type': 'text/html' });
  res.end('<h1>404</h1>');
}).listen(PORT, '127.0.0.1', () => console.error(`host up on ${PORT}`));
