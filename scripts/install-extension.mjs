import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const target = join(
  homedir(),
  'Library/Application Support/com.tauritavern.client/data/extensions/third-party/krill-image-bridge',
);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(join(root, 'extension'), target, { recursive: true });

await rm(join(target, 'shared'), { recursive: true, force: true });
await mkdir(join(target, 'shared'), { recursive: true });
for (const filename of await readdir(join(root, 'src/shared'))) {
  if (!filename.endsWith('.js') || filename.endsWith('.test.js')) continue;
  await cp(join(root, 'src/shared', filename), join(target, 'shared', filename));
}

console.log(`Installed Krill Image Bridge extension to ${target}`);
