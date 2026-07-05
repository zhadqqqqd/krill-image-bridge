import { loadTauriTavernCustomApiConfig } from './tauritavern-config.js';
import { loadCodexApiConfig } from './codex-config.js';

const DEFAULT_BASE_URL = 'https://api.cdn-krill-ai.com/codex/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_QUALITY = 'high';
const RATIO_SIZES = {
  '1:1': '1024x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1024x576',
  '9:16': '576x1024',
};

export async function generateKrillImage(payload, options = {}) {
  const codexConfig = await loadCodexApiConfig(options.codexHome);
  const tauriConfig = await loadTauriTavernCustomApiConfig(options.tauriDataDir);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error('fetch is not available');
  if (!payload?.prompt) throw new Error('prompt is required');

  const endpoint = resolveEndpoint(options, codexConfig);
  const body = {
    model: payload.model || options.model || process.env.KRILL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    prompt: payload.prompt,
    n: 1,
    size: payload.resolution || RATIO_SIZES[payload.ratio] || options.defaultSize || '1024x1024',
    quality: payload.quality || options.quality || process.env.KRILL_IMAGE_QUALITY || DEFAULT_IMAGE_QUALITY,
    response_format: 'b64_json',
  };

  const headers = {
    'content-type': 'application/json',
  };
  const apiKey = options.apiKey || process.env.KRILL_API_KEY || codexConfig.apiKey || tauriConfig.apiKey;
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await safeReadText(response);
    throw new Error(`Krill image request failed (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      extension: extensionFromContentType(contentType),
    };
  }

  return normalizeKrillImageResponse(await response.json(), { fetchImpl });
}

export async function normalizeKrillImageResponse(responseBody, { fetchImpl = globalThis.fetch } = {}) {
  const candidate = findImageCandidate(responseBody);
  if (!candidate) {
    throw new Error('Krill response did not include an image');
  }

  if (candidate.kind === 'base64') {
    return {
      buffer: Buffer.from(stripBase64Prefix(candidate.value), 'base64'),
      extension: candidate.extension || 'png',
    };
  }

  if (candidate.kind === 'url') {
    if (!fetchImpl) throw new Error('fetch is required to download URL image responses');
    const response = await fetchImpl(candidate.value);
    if (!response.ok) {
      throw new Error(`Image download failed (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || '';
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      extension: extensionFromContentType(contentType) || extensionFromUrl(candidate.value),
    };
  }

  throw new Error(`Unsupported Krill image response kind: ${candidate.kind}`);
}

function resolveEndpoint(options, codexConfig = {}) {
  if (options.endpoint || process.env.KRILL_IMAGE_ENDPOINT) {
    return options.endpoint || process.env.KRILL_IMAGE_ENDPOINT;
  }
  const baseUrl = (options.baseUrl || process.env.KRILL_API_BASE || codexConfig.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  return `${baseUrl}/images/generations`;
}

function findImageCandidate(body) {
  const candidates = [
    body?.b64_json,
    body?.b64,
    body?.base64,
    body?.image_base64,
    body?.url,
    body?.image_url,
    body?.image?.url,
    body?.image?.b64_json,
    body?.data?.[0],
    body?.images?.[0],
    body?.output?.[0],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeCandidate(candidate) {
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    if (/^https?:\/\//i.test(candidate)) return { kind: 'url', value: candidate };
    if (/^data:image\//i.test(candidate)) {
      const extension = candidate.match(/^data:image\/([^;,]+)/i)?.[1] || 'png';
      return { kind: 'base64', value: candidate, extension: normalizeExtension(extension) };
    }
    return { kind: 'base64', value: candidate, extension: 'png' };
  }
  if (typeof candidate === 'object') {
    return normalizeCandidate(candidate.b64_json)
      || normalizeCandidate(candidate.b64)
      || normalizeCandidate(candidate.base64)
      || normalizeCandidate(candidate.image_base64)
      || normalizeCandidate(candidate.url)
      || normalizeCandidate(candidate.image_url?.url)
      || normalizeCandidate(candidate.image_url)
      || normalizeCandidate(candidate.content?.[0]?.image_url?.url)
      || normalizeCandidate(candidate.content?.[0]?.image_url)
      || normalizeCandidate(candidate.content?.[0]?.b64_json);
  }
  return null;
}

function stripBase64Prefix(value) {
  return String(value).replace(/^data:image\/[^;]+;base64,/i, '');
}

function extensionFromContentType(contentType) {
  if (/jpeg/i.test(contentType)) return 'jpg';
  if (/png/i.test(contentType)) return 'png';
  if (/webp/i.test(contentType)) return 'webp';
  return '';
}

function extensionFromUrl(url) {
  const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
  return normalizeExtension(match?.[1] || 'png');
}

function normalizeExtension(extension) {
  const normalized = String(extension || 'png').replace(/^jpeg$/i, 'jpg').toLowerCase();
  return normalized.replace(/[^a-z0-9]/g, '') || 'png';
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return response.statusText || 'Unknown error';
  }
}
