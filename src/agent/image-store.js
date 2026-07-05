import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export async function saveImageBuffer(buffer, {
  imageDir,
  publicBaseUrl,
  extension = 'png',
  caption = 'Krill image',
}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('saveImageBuffer expects a Buffer');
  }
  if (!imageDir) {
    throw new Error('imageDir is required');
  }

  await mkdir(imageDir, { recursive: true });
  const safeExtension = sanitizeExtension(extension);
  const filename = `${timestamp()}-${randomBytes(4).toString('hex')}.${safeExtension}`;
  const path = join(imageDir, filename);
  await writeFile(path, buffer);
  const url = `${String(publicBaseUrl).replace(/\/$/, '')}/${filename}`;
  return {
    filename,
    path,
    url,
    markdown: `![${escapeAlt(caption)}](${url})`,
  };
}

export function resolvePublicBaseUrl({
  publicBaseUrl = '',
  host = '127.0.0.1',
  port = 8788,
} = {}) {
  const trimmed = String(publicBaseUrl || '').replace(/\/$/, '');
  if (trimmed) {
    return trimmed.endsWith('/images') ? trimmed : `${trimmed}/images`;
  }
  return `http://${host}:${port}/images`;
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sanitizeExtension(extension) {
  const safe = String(extension || 'png').replace(/^\.+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return safe || 'png';
}

function escapeAlt(value) {
  return String(value || 'Krill image').replace(/[\[\]\n\r]/g, ' ').trim() || 'Krill image';
}
