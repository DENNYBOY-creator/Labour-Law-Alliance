// Downloads the site's images from the current WordPress site into assets/images/.
// Run ONCE, before you switch the domain away from WordPress:
//   node scripts/fetch-images.mjs
// Requires Node.js 18+ (built-in fetch).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'images');
const WP = 'https://labourlawalliance.co.za/wp-content/uploads';

const files = {
  'logo.png': `${WP}/2026/03/Labour-Law-logo-723.png`,
  'about-us.png': `${WP}/2026/03/about-us.png`,
  'hero-1.png': `${WP}/2026/03/Untitled-3.png`,
  'hero-2.png': `${WP}/2026/03/Untitled-4.png`,
  'shape-2.webp': `${WP}/2022/05/shape-2-e1652457140698.webp`,
  'favicon-32.png': `${WP}/2026/03/cropped-cropped-cropped-Labour-Law-3-32x32.png`,
  'favicon-180.png': `${WP}/2026/03/cropped-cropped-cropped-Labour-Law-3-180x180.png`,
  'favicon-192.png': `${WP}/2026/03/cropped-cropped-cropped-Labour-Law-3-192x192.png`,
};

await mkdir(out, { recursive: true });
let failed = 0;
for (const [name, url] of Object.entries(files)) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(join(out, name), buf);
    console.log(`✓ ${name}  (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}  ${url}  → ${e.message}`);
  }
}
console.log(failed ? `\n${failed} file(s) failed — download them manually from the URLs above.` : '\nAll images saved to assets/images/');
