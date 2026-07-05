import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;

test('GitHub extension package exposes manifest at repository root', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));

  assert.equal(manifest.display_name, 'Krill Image Bridge');
  assert.deepEqual(manifest.requires, []);
  assert.deepEqual(manifest.optional, []);
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'style.css');
  await access(join(root, manifest.js));
  await access(join(root, manifest.css));
  await access(join(root, 'settings.html'));
  await access(join(root, 'shared/direct-image-api.js'));
  await access(join(root, 'shared/message-insertion.js'));
  await access(join(root, 'shared/trigger-parser.js'));
});
