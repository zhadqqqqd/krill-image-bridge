import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_CODEX_HOME = join(homedir(), '.codex');

export async function loadCodexApiConfig(codexHome = process.env.CODEX_HOME || DEFAULT_CODEX_HOME) {
  try {
    const [configText, auth] = await Promise.all([
      readFile(join(codexHome, 'config.toml'), 'utf8'),
      readJson(join(codexHome, 'auth.json')),
    ]);
    const providerName = parseTopLevelString(configText, 'model_provider');
    const baseUrl = providerName ? parseProviderBaseUrl(configText, providerName) : '';
    const apiKey = auth?.OPENAI_API_KEY || '';
    return {
      ...(baseUrl ? { baseUrl } : {}),
      ...(apiKey ? { apiKey } : {}),
    };
  } catch {
    return {};
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function parseTopLevelString(text, key) {
  const escaped = escapeRegExp(key);
  const match = text.match(new RegExp(`^${escaped}\\s*=\\s*["']([^"']+)["']`, 'm'));
  return match?.[1] || '';
}

function parseProviderBaseUrl(text, providerName) {
  const section = `model_providers.${providerName}`;
  const lines = text.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      inSection = sectionMatch[1] === section;
      continue;
    }
    if (!inSection) continue;
    const baseUrlMatch = line.match(/^\s*base_url\s*=\s*["']([^"']+)["']/);
    if (baseUrlMatch) return baseUrlMatch[1];
  }
  return '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
