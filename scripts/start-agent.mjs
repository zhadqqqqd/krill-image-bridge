import { startKrillAgent } from '../src/agent/server.js';
import { resolveLanBaseUrl } from '../src/agent/lan-url.js';

const args = new Set(process.argv.slice(2));
const lanMode = args.has('--lan') || process.env.KRILL_LAN_MODE === '1';
const port = Number(process.env.KRILL_AGENT_PORT || 8788);

if (lanMode) {
  process.env.KRILL_AGENT_HOST ||= '0.0.0.0';
  process.env.KRILL_PUBLIC_BASE_URL ||= resolveLanBaseUrl({ port });
}

startKrillAgent();

if (lanMode) {
  console.log(`iPhone Agent URL: ${process.env.KRILL_PUBLIC_BASE_URL}`);
  console.log('Use this URL in the TauriTavern extension Agent URL field.');
}
