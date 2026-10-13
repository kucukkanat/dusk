// Build: copy src/ to dist/ and stamp the service worker with a content hash
// and the list of files to precache. Runs with Bun (`bun run build`) or Node 18+.
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = 'src';
const OUT = 'dist';

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(OUT)
  .map((p) => relative(OUT, p).split(sep).join('/'))
  .filter((p) => p !== 'sw.js' && !p.endsWith('.LICENSE'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest('hex').slice(0, 12);

const precache = ['./', ...files];
const swPath = join(OUT, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8')
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache, null, 2)));

writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`Built ${files.length} files into ${OUT}/ (version ${version})`);
