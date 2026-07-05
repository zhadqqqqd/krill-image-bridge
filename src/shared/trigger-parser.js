const VALID_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16']);

export function extractImageRequests(text, options = {}) {
  const settings = {
    structured: true,
    naturalLanguage: false,
    sfwTags: false,
    maxRequests: 1,
    ...options,
  };
  const requests = [];
  if (!text || typeof text !== 'string') return requests;

  if (settings.structured) {
    requests.push(...extractStructured(text));
  }
  if (settings.sfwTags) {
    requests.push(...extractAssetTags(text));
  }
  if (settings.naturalLanguage && requests.length === 0) {
    const natural = extractNaturalLanguage(text);
    if (natural) requests.push(natural);
  }
  return requests.slice(0, settings.maxRequests);
}

export function buildDedupKey(chatId, messageId, raw) {
  return `${chatId || 'chat'}:${messageId}:${hashString(raw || '')}`;
}

function extractStructured(text) {
  const patterns = [
    /<krill_image>([\s\S]*?)<\/krill_image>/gi,
    /<image_prompt>([\s\S]*?)<\/image_prompt>/gi,
    /\[GENERATE_IMAGE:\s*([^\]]+)\]/gi,
    /\{\{image:\s*([^}]+)\}\}/gi,
  ];

  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => {
    const body = match[1].trim();
    const fields = parseFields(body);
    return {
      kind: 'structured',
      prompt: fields.prompt || body,
      caption: fields.caption || 'Krill image',
      ratio: VALID_RATIOS.has(fields.ratio) ? fields.ratio : '',
      raw: match[0],
    };
  }));
}

function parseFields(body) {
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*(prompt|caption|ratio)\s*[:：]\s*(.+?)\s*$/i);
    if (match) fields[match[1].toLowerCase()] = match[2].trim();
  }
  return fields;
}

function extractNaturalLanguage(text) {
  const chinese = text.match(/(?:发送|生成|画|绘制|渲染|做)(?:给你|一张|一个|一下|出)?\s*(?:图片|照片|插图|场景图|图像)?(?:的|：|:)?\s*([^。！？\n]{2,80}(?:图|场景|画面|照片|插图)?)/);
  if (chinese) {
    return {
      kind: 'natural-language',
      prompt: cleanPrompt(chinese[1]),
      caption: 'Krill image',
      ratio: '',
      raw: chinese[0],
    };
  }

  const english = text.match(/\b(?:send|mail|imagine|generate|make|create|draw|paint|render)\b.{0,20}\b(?:pic|picture|image|drawing|painting|photo|photograph)\b(?:\s+of\s+|\s+for\s+)?([^.!?\n]{2,120})/i);
  if (english) {
    return {
      kind: 'natural-language',
      prompt: cleanPrompt(english[1]),
      caption: 'Krill image',
      ratio: '',
      raw: english[0],
    };
  }
  return null;
}

function extractAssetTags(text) {
  return [...text.matchAll(/<(SFW_IMG|NSFW_IMG)>([\s\S]*?)<\/\1>/gi)].map((match) => ({
    kind: 'asset-tag',
    prompt: match[2].trim(),
    caption: match[1],
    ratio: '',
    raw: match[0],
  }));
}

function cleanPrompt(value) {
  return String(value || '').replace(/[。！？.!?]+$/g, '').trim();
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
