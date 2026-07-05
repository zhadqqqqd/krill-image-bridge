import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanBaseUrl } from './lan-url.js';

test('resolveLanBaseUrl prefers private IPv4 addresses for iPhone access', () => {
  const baseUrl = resolveLanBaseUrl({
    port: 8788,
    interfaces: {
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      en0: [{ address: '192.168.31.12', family: 'IPv4', internal: false }],
    },
  });

  assert.equal(baseUrl, 'http://192.168.31.12:8788');
});

test('resolveLanBaseUrl falls back to localhost when no external IPv4 exists', () => {
  const baseUrl = resolveLanBaseUrl({
    port: 8788,
    interfaces: {
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    },
  });

  assert.equal(baseUrl, 'http://127.0.0.1:8788');
});
