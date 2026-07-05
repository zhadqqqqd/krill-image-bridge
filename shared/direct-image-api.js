const DEFAULT_API_BASE_URL = 'https://api.krill-ai.com/codex/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_QUALITY = 'high';
const RATIO_SIZES = {
  '1:1': '1024x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1024x576',
  '9:16': '576x1024',
};

export async function generateDirectImage(request, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error('fetch is not available');
  if (!request?.prompt) throw new Error('prompt is required');

  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new Error('API key is required for direct image generation');

  const response = await fetchImpl(resolveImageEndpoint(options.apiBaseUrl, options.endpoint), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildImageGenerationBody(request, options)),
  });

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}): ${await safeReadText(response)}`);
  }

  return normalizeDirectImageResponse(await response.json(), {
    caption: request.caption || 'Krill image',
  });
}

export function buildImageGenerationBody(request, options = {}) {
  return {
    model: request.model || options.model || DEFAULT_IMAGE_MODEL,
    prompt: request.prompt,
    n: 1,
    size: request.resolution || RATIO_SIZES[request.ratio] || options.defaultSize || '1024x1024',
    quality: request.quality || options.quality || DEFAULT_IMAGE_QUALITY,
    response_format: 'b64_json',
  };
}

export function resolveImageEndpoint(apiBaseUrl = DEFAULT_API_BASE_URL, endpoint = '') {
  if (endpoint) return endpoint;
  return `${String(apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '')}/images/generations`;
}

export function normalizeDirectImageResponse(body, { caption = 'Krill image' } = {}) {
  const candidate = findImageCandidate(body);
  if (!candidate) throw new Error('Image response did not include an image');

  const url = candidate.kind === 'url'
    ? candidate.value
    : toDataImageUrl(candidate.value, candidate.extension || 'png');

  return {
    url,
    markdown: `![${escapeAlt(caption)}](${url})`,
  };
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
      return { kind: 'base64', value: candidate, extension };
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

function toDataImageUrl(value, extension) {
  const raw = String(value);
  if (/^data:image\//i.test(raw)) return raw;
  return `data:image/${normalizeExtension(extension)};base64,${stripBase64Prefix(raw)}`;
}

function stripBase64Prefix(value) {
  return String(value).replace(/^data:image\/[^;]+;base64,/i, '');
}

function normalizeExtension(extension) {
  return String(extension || 'png').replace(/^jpeg$/i, 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
}

function escapeAlt(value) {
  return String(value || 'Krill image').replace(/[\[\]\n\r]/g, ' ').trim() || 'Krill image';
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return response.statusText || 'Unknown error';
  }
}
