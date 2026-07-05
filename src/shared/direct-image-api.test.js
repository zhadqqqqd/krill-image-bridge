import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImageGenerationBody,
  generateDirectImage,
  normalizeDirectImageResponse,
  resolveImageEndpoint,
} from './direct-image-api.js';

test('resolveImageEndpoint appends OpenAI-compatible image generation path', () => {
  assert.equal(
    resolveImageEndpoint('https://api.krill-ai.com/codex/v1/'),
    'https://api.krill-ai.com/codex/v1/images/generations',
  );
});

test('buildImageGenerationBody defaults to gpt-image-2 high quality and ratio size', () => {
  assert.deepEqual(buildImageGenerationBody({
    prompt: 'ancient gate',
    ratio: '16:9',
  }), {
    model: 'gpt-image-2',
    prompt: 'ancient gate',
    n: 1,
    size: '1024x576',
    quality: 'high',
    response_format: 'b64_json',
  });
});

test('normalizeDirectImageResponse converts b64_json to markdown data URL', () => {
  const normalized = normalizeDirectImageResponse({
    data: [{ b64_json: 'aW1hZ2U=' }],
  }, { caption: '万妖之门' });

  assert.equal(normalized.url, 'data:image/png;base64,aW1hZ2U=');
  assert.equal(normalized.markdown, '![万妖之门](data:image/png;base64,aW1hZ2U=)');
});

test('generateDirectImage posts directly to the configured API endpoint', async () => {
  let captured;
  const result = await generateDirectImage({
    prompt: 'moon tavern',
    caption: 'Moon tavern',
    ratio: '1:1',
  }, {
    apiKey: 'test-key',
    apiBaseUrl: 'https://api.krill-ai.com/codex/v1',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return jsonResponse({ data: [{ b64_json: 'ZmFrZQ==' }] });
    },
  });

  assert.equal(captured.url, 'https://api.krill-ai.com/codex/v1/images/generations');
  assert.equal(captured.init.headers.authorization, 'Bearer test-key');
  assert.equal(JSON.parse(captured.init.body).model, 'gpt-image-2');
  assert.equal(result.markdown, '![Moon tavern](data:image/png;base64,ZmFrZQ==)');
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}
