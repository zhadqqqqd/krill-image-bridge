export function insertGeneratedImageMarkdown(originalText, {
  raw = '',
  markdown,
  mode = 'replace',
}) {
  const text = String(originalText || '');
  const imageMarkdown = String(markdown || '').trim();
  if (!imageMarkdown) return text;

  if (mode === 'replace' && raw && text.includes(raw)) {
    return text.replace(raw, imageMarkdown);
  }

  return `${text.replace(/\s+$/g, '')}\n\n${imageMarkdown}`;
}

export function resolveInsertionMode(request, configuredMode = 'replace') {
  if (request?.kind === 'asset-tag') return 'replace';
  return configuredMode || 'replace';
}
