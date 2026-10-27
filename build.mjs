// The build step. It inlines the environment it can see, right now, into the
// bundle -- which is why a variable added after the build is not in it.
import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';

const OUT = new URL('./dist/', import.meta.url);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(new URL('./app/', import.meta.url), OUT, { recursive: true });

const src = await readFile(new URL('app.js', OUT), 'utf8');
// replaceAll, not replace: a string pattern given to replace() substitutes only
// the first occurrence, which here was the one in the comment at the top.
const built = src
  .replaceAll('__API_BASE__', process.env.API_BASE ?? '')
  .replaceAll('__AUTH_URL__', process.env.AUTH_URL ?? '');
await writeFile(new URL('app.js', OUT), built);

console.error(`built with API_BASE=${process.env.API_BASE ?? '(unset)'} AUTH_URL=${process.env.AUTH_URL ?? '(unset)'}`);
