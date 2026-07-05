import { networkInterfaces } from 'node:os';

export function resolveLanBaseUrl({
  port = 8788,
  interfaces = networkInterfaces(),
  protocol = 'http',
} = {}) {
  const address = selectLanAddress(interfaces) || '127.0.0.1';
  return `${protocol}://${address}:${Number(port || 8788)}`;
}

export function selectLanAddress(interfaces = networkInterfaces()) {
  const candidates = Object.values(interfaces)
    .flat()
    .filter(Boolean)
    .filter((entry) => isIPv4(entry) && !entry.internal)
    .map((entry) => entry.address);

  return candidates.find(isPrivateIPv4) || candidates[0] || '';
}

function isIPv4(entry) {
  return entry.family === 'IPv4' || entry.family === 4;
}

function isPrivateIPv4(address) {
  if (/^10\./.test(address)) return true;
  if (/^192\.168\./.test(address)) return true;
  const match = address.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}
