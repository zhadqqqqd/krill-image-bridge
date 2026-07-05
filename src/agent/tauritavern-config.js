import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_TAURITAVERN_DATA_DIR = join(
  homedir(),
  'Library/Application Support/com.tauritavern.client/data/default-user',
);

export async function loadTauriTavernCustomApiConfig(dataDir = process.env.TAURITAVERN_DATA_DIR || DEFAULT_TAURITAVERN_DATA_DIR) {
  try {
    const [settings, secrets] = await Promise.all([
      readJson(join(dataDir, 'settings.json')),
      readJson(join(dataDir, 'secrets.json')),
    ]);
    const activeKey = findActiveCustomKey(secrets?.api_key_custom);
    return {
      ...(settings?.oai_settings?.custom_url ? { baseUrl: settings.oai_settings.custom_url } : {}),
      ...(activeKey ? { apiKey: activeKey } : {}),
    };
  } catch {
    return {};
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function findActiveCustomKey(value) {
  if (Array.isArray(value)) {
    const active = value.find((item) => item?.active && item?.value);
    return active?.value || value.find((item) => item?.value)?.value || '';
  }
  if (typeof value === 'string') return value;
  return '';
}
