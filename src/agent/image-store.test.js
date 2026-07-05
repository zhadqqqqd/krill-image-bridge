import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveImageBuffer, resolvePublicBaseUrl } from './image-store.js';

test('saves image buffer and returns public URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'krill-images-'));
  try {
    const result = await saveImageBuffer(Buffer.from('png-data'), {
      imageDir: dir,
      publicBaseUrl: 'http://127.0.0.1:8788/images',
      extension: 'png',
      caption: '万妖之门',
    });

    assert.match(result.filename, /^\d{8}-\d{6}-[a-f0-9]{8}\.png$/);
    assert.equal(result.url, `http://127.0.0.1:8788/images/${result.filename}`);
    assert.equal(result.markdown, `![万妖之门](${result.url})`);
    assert.equal(await readFile(result.path, 'utf8'), 'png-data');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sanitizes extension and markdown alt text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'krill-images-'));
  try {
    const result = await saveImageBuffer(Buffer.from('jpeg-data'), {
      imageDir: dir,
      publicBaseUrl: 'http://127.0.0.1:8788/images/',
      extension: '../jpg',
      caption: 'bad [alt]\ntext',
    });

    assert.match(result.filename, /\.jpg$/);
    assert.equal(result.markdown, `![bad  alt  text](${result.url})`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolves public base URL from LAN base setting', () => {
  assert.equal(
    resolvePublicBaseUrl({ publicBaseUrl: 'http://192.168.1.20:8788', port: 8788 }),
    'http://192.168.1.20:8788/images',
  );
});
