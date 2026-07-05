import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKrillAgentServer } from './server.js';

test('health endpoint reports ok', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'krill-agent-'));
  const server = createKrillAgentServer({
    imageDir: dir,
    host: '0.0.0.0',
    publicBaseUrl: 'http://192.168.1.23:8788',
  });
  await listen(server);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    const json = await response.json();
    assert.equal(json.ok, true);
    assert.equal(json.publicBaseUrl, 'http://192.168.1.23:8788');
    assert.equal(json.imageBaseUrl, 'http://192.168.1.23:8788/images');
    assert.equal(json.host, '0.0.0.0');
  } finally {
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test('generate endpoint saves image and returns markdown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'krill-agent-'));
  const server = createKrillAgentServer({
    imageDir: dir,
    publicBaseUrl: 'http://127.0.0.1:8788',
    generateImage: async (payload) => {
      assert.equal(payload.prompt, 'ancient gate');
      return { buffer: Buffer.from('image-data'), extension: 'png' };
    },
  });
  await listen(server);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'ancient gate', caption: '万妖之门' }),
    });
    const json = await response.json();

    assert.equal(json.ok, true);
    assert.match(json.url, /^http:\/\/127\.0\.0\.1:8788\/images\/.+\.png$/);
    assert.match(json.markdown, /^!\[万妖之门\]\(http:\/\/127\.0\.0\.1:8788\/images\/.+\.png\)$/);
    assert.equal(await readFile(json.path, 'utf8'), 'image-data');
  } finally {
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test('generate endpoint rejects missing prompt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'krill-agent-'));
  const server = createKrillAgentServer({ imageDir: dir });
  await listen(server);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caption: 'no prompt' }),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
  } finally {
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}
