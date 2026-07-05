import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCodexApiConfig } from './codex-config.js';

test('loads active Codex provider base URL and OpenAI API key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-config-'));
  try {
    await writeFile(join(dir, 'config.toml'), `
model_provider = "custom"

[model_providers.custom]
name = "Krill"
base_url = "https://api.cdn-krill-ai.com/codex/v1"
wire_api = "responses"
`);
    await writeFile(join(dir, 'auth.json'), JSON.stringify({
      OPENAI_API_KEY: 'codex-key',
    }));

    assert.deepEqual(await loadCodexApiConfig(dir), {
      baseUrl: 'https://api.cdn-krill-ai.com/codex/v1',
      apiKey: 'codex-key',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('returns empty object when Codex files are missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-config-'));
  try {
    await mkdir(join(dir, 'nested'));
    assert.deepEqual(await loadCodexApiConfig(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
