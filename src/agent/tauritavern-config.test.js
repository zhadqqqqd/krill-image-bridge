import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTauriTavernCustomApiConfig } from './tauritavern-config.js';

test('loads custom API base URL and active key from TauriTavern data dir', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tauritavern-config-'));
  try {
    await writeFile(join(dir, 'settings.json'), JSON.stringify({
      oai_settings: {
        custom_url: 'https://api.krill-ai.com/coding/v1',
      },
    }));
    await writeFile(join(dir, 'secrets.json'), JSON.stringify({
      api_key_custom: [
        { active: false, value: 'inactive-key', label: 'old' },
        { active: true, value: 'active-key', label: 'codex' },
      ],
    }));

    assert.deepEqual(await loadTauriTavernCustomApiConfig(dir), {
      baseUrl: 'https://api.krill-ai.com/coding/v1',
      apiKey: 'active-key',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('returns empty object when config files are missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tauritavern-config-'));
  try {
    await mkdir(join(dir, 'nested'));
    assert.deepEqual(await loadTauriTavernCustomApiConfig(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
