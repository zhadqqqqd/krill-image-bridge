import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKrillImage, normalizeKrillImageResponse } from './krill-adapter.js';

test('normalizes base64 image response', async () => {
  const result = await normalizeKrillImageResponse({ b64_json: Buffer.from('abc').toString('base64') });

  assert.equal(result.extension, 'png');
  assert.equal(result.buffer.toString(), 'abc');
});

test('normalizes OpenAI-style data response', async () => {
  const result = await normalizeKrillImageResponse({
    data: [{ b64_json: Buffer.from('xyz').toString('base64') }],
  });

  assert.equal(result.extension, 'png');
  assert.equal(result.buffer.toString(), 'xyz');
});

test('normalizes remote URL response by downloading image', async () => {
  const result = await normalizeKrillImageResponse(
    { data: [{ url: 'https://example.test/image.jpg' }] },
    {
      fetchImpl: async (url) => {
        assert.equal(url, 'https://example.test/image.jpg');
        return new Response(Buffer.from('jpg-data'), {
          headers: { 'content-type': 'image/jpeg' },
        });
      },
    },
  );

  assert.equal(result.extension, 'jpg');
  assert.equal(result.buffer.toString(), 'jpg-data');
});

test('generateKrillImage posts OpenAI-compatible image generation request', async () => {
  let captured;
  const result = await generateKrillImage(
    {
      prompt: 'ancient gate',
      model: 'gpt-image-2',
      ratio: '16:9',
    },
    {
      apiKey: 'secret',
      baseUrl: 'https://api.krill-ai.com/v1',
      codexHome: '/path/that/does/not/exist',
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return Response.json({
          data: [{ b64_json: Buffer.from('png-data').toString('base64') }],
        });
      },
    },
  );

  assert.equal(captured.url, 'https://api.krill-ai.com/v1/images/generations');
  assert.equal(captured.init.headers.authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(captured.init.body), {
    model: 'gpt-image-2',
    prompt: 'ancient gate',
    n: 1,
    size: '1024x576',
    quality: 'high',
    response_format: 'b64_json',
  });
  assert.equal(result.buffer.toString(), 'png-data');
});

test('generateKrillImage defaults to Codex base URL, gpt-image-2, and high quality', async () => {
  let captured;
  await generateKrillImage(
    { prompt: 'default model prompt' },
    {
      apiKey: 'secret',
      codexHome: '/path/that/does/not/exist',
      tauriDataDir: '/path/that/does/not/exist',
      fetchImpl: async (url, init) => {
        captured = { url, body: JSON.parse(init.body) };
        return Response.json({
          data: [{ b64_json: Buffer.from('png-data').toString('base64') }],
        });
      },
    },
  );

  assert.equal(captured.url, 'https://api.cdn-krill-ai.com/codex/v1/images/generations');
  assert.equal(captured.body.model, 'gpt-image-2');
  assert.equal(captured.body.quality, 'high');
});
