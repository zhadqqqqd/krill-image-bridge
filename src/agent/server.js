import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';
import { generateKrillImage } from './krill-adapter.js';
import { resolvePublicBaseUrl, saveImageBuffer } from './image-store.js';

export function createKrillAgentServer(options = {}) {
  const config = {
    host: options.host || process.env.KRILL_AGENT_HOST || '127.0.0.1',
    port: Number(options.port || process.env.KRILL_AGENT_PORT || 8788),
    imageDir: options.imageDir || process.env.KRILL_IMAGE_DIR || join(process.cwd(), 'data', 'images'),
    publicBaseUrl: options.publicBaseUrl || process.env.KRILL_PUBLIC_BASE_URL || '',
    generateImage: options.generateImage || ((payload) => generateKrillImage(payload, options)),
  };

  return createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

      if (request.method === 'GET' && url.pathname === '/health') {
        const publicBaseUrl = resolveRequestPublicBaseUrl({
          configuredBaseUrl: config.publicBaseUrl,
          requestHost: request.headers.host,
          host: config.host,
          port: config.port,
        });
        return writeJson(response, 200, {
          ok: true,
          host: config.host,
          port: config.port,
          publicBaseUrl,
          imageBaseUrl: resolvePublicBaseUrl({ publicBaseUrl }),
        });
      }

      if (request.method === 'POST' && url.pathname === '/generate') {
        const payload = await readJson(request);
        if (!payload.prompt || typeof payload.prompt !== 'string') {
          return writeJson(response, 400, { ok: false, error: 'prompt is required' });
        }

        const generated = await config.generateImage(payload);
        const publicBaseUrl = resolvePublicBaseUrl({
          publicBaseUrl: config.publicBaseUrl,
          host: request.headers.host?.split(':')[0] || config.host,
          port: config.port,
        });
        const saved = await saveImageBuffer(generated.buffer, {
          imageDir: config.imageDir,
          publicBaseUrl,
          extension: generated.extension || 'png',
          caption: payload.caption || 'Krill image',
        });

        return writeJson(response, 200, {
          ok: true,
          url: saved.url,
          markdown: saved.markdown,
          prompt: payload.prompt,
          filename: saved.filename,
          path: saved.path,
        });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
        return serveImage(response, config.imageDir, url.pathname.replace('/images/', ''));
      }

      return writeJson(response, 404, { ok: false, error: 'not found' });
    } catch (error) {
      return writeJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function resolveRequestPublicBaseUrl({
  configuredBaseUrl = '',
  requestHost = '',
  host = '127.0.0.1',
  port = 8788,
}) {
  const trimmed = String(configuredBaseUrl || '').replace(/\/$/, '');
  if (trimmed) return trimmed.replace(/\/images$/, '');
  return `http://${requestHost || `${host}:${port}`}`;
}

export function startKrillAgent(options = {}) {
  const server = createKrillAgentServer(options);
  const host = options.host || process.env.KRILL_AGENT_HOST || '127.0.0.1';
  const port = Number(options.port || process.env.KRILL_AGENT_PORT || 8788);
  server.listen(port, host, () => {
    console.log(`Krill Image Agent listening on http://${host}:${port}`);
  });
  return server;
}

function setCorsHeaders(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type,authorization');
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function writeJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function serveImage(response, imageDir, unsafeFilename) {
  const filename = basename(unsafeFilename);
  const path = join(imageDir, filename);
  try {
    await access(path);
  } catch {
    return writeJson(response, 404, { ok: false, error: 'image not found' });
  }

  response.writeHead(200, { 'content-type': contentTypeFor(filename) });
  createReadStream(path).pipe(response);
}

function contentTypeFor(filename) {
  if (/\.jpe?g$/i.test(filename)) return 'image/jpeg';
  if (/\.webp$/i.test(filename)) return 'image/webp';
  return 'image/png';
}
