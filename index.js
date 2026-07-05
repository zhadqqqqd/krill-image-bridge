import { extractImageRequests, buildDedupKey } from './shared/trigger-parser.js';
import { insertGeneratedImageMarkdown } from './shared/message-insertion.js';
import { generateDirectImage, resolveImageEndpoint } from './shared/direct-image-api.js';
import { getEventTypes, recentMessageIds, resolveMessageIdsFromEvent } from './shared/event-routing.js';

const EXTENSION_NAME = 'third-party/krill-image-bridge';
const SETTINGS_KEY = 'krillImageBridge';
const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.krill-ai.com/codex/v1',
  apiKey: '',
  settingsVersion: 3,
  autoDetect: true,
  interactiveUserRequests: true,
  structured: true,
  naturalLanguage: true,
  sfwTags: true,
  functionTool: true,
  mode: 'replace',
  maxRequests: 1,
  defaultModel: 'gpt-image-2',
  defaultRatio: '16:9',
  defaultResolution: '1024x576',
  defaultQuality: 'high',
};

let context;
let settings;
const inFlight = new Set();
const processed = new Set();

jQuery(async () => {
  context = SillyTavern.getContext();
  settings = loadSettings();
  await renderSettings();
  registerMessageListener();
  registerSlashCommand();
  registerFunctionTool();
  updateStatus('Krill Image Bridge 已加载');
});

function loadSettings() {
  context.extensionSettings[SETTINGS_KEY] ||= {};
  const stored = context.extensionSettings[SETTINGS_KEY];
  const migrated = { ...DEFAULT_SETTINGS, ...stored };
  if (Number(stored.settingsVersion || 0) < 3) {
    migrated.interactiveUserRequests = true;
    migrated.sfwTags = true;
    migrated.functionTool = true;
    migrated.settingsVersion = 3;
    context.extensionSettings[SETTINGS_KEY] = { ...migrated };
    context.saveSettingsDebounced?.();
  }
  return migrated;
}

function persistSettings() {
  context.extensionSettings[SETTINGS_KEY] = { ...settings };
  context.saveSettingsDebounced();
}

async function renderSettings() {
  const html = await context.renderExtensionTemplateAsync(EXTENSION_NAME, 'settings', {});
  const container = jQuery('#extensions_settings2').length ? jQuery('#extensions_settings2') : jQuery('#extensions_settings');
  container.append(html);

  bindInput('#krill_bridge_api_base_url', 'apiBaseUrl');
  bindInput('#krill_bridge_api_key', 'apiKey');
  bindInput('#krill_bridge_model', 'defaultModel');
  bindInput('#krill_bridge_ratio', 'defaultRatio');
  bindInput('#krill_bridge_resolution', 'defaultResolution');
  bindInput('#krill_bridge_quality', 'defaultQuality');
  bindNumber('#krill_bridge_max_requests', 'maxRequests');
  bindCheckbox('#krill_bridge_auto_detect', 'autoDetect');
  bindCheckbox('#krill_bridge_interactive_user_requests', 'interactiveUserRequests');
  bindCheckbox('#krill_bridge_structured', 'structured');
  bindCheckbox('#krill_bridge_natural_language', 'naturalLanguage');
  bindCheckbox('#krill_bridge_sfw_tags', 'sfwTags');
  bindCheckbox('#krill_bridge_function_tool', 'functionTool');

  jQuery('#krill_bridge_mode').val(settings.mode).on('change', function () {
    settings.mode = String(jQuery(this).val() || 'replace');
    persistSettings();
  });
  jQuery('#krill_bridge_copy_contract').on('click', async () => {
    await navigator.clipboard.writeText(roleCardContract());
    updateStatus('角色卡生图协议已复制');
  });
  jQuery('#krill_bridge_check_config').on('click', checkDirectConfig);
}

function bindInput(selector, key) {
  jQuery(selector).val(settings[key]).on('input', function () {
    settings[key] = String(jQuery(this).val() || '');
    persistSettings();
  });
}

function bindNumber(selector, key) {
  jQuery(selector).val(settings[key]).on('input', function () {
    settings[key] = Math.max(1, Number(jQuery(this).val() || 1));
    persistSettings();
  });
}

function bindCheckbox(selector, key) {
  jQuery(selector).prop('checked', Boolean(settings[key])).on('change', function () {
    settings[key] = Boolean(jQuery(this).prop('checked'));
    persistSettings();
  });
}

function registerMessageListener() {
  const eventTypes = getEventTypes(context);
  const on = (eventName, handler) => {
    if (!eventName || !context.eventSource?.on) return;
    context.eventSource.on(eventName, handler);
  };

  on(eventTypes.MESSAGE_RECEIVED, (payload) => scheduleProcessEvent(payload, { allowUser: false }));
  on(eventTypes.CHARACTER_MESSAGE_RENDERED, (payload) => scheduleProcessEvent(payload, { allowUser: false }));
  on(eventTypes.MESSAGE_SENT, (payload) => scheduleProcessEvent(payload, { allowUser: true }));
  on(eventTypes.USER_MESSAGE_RENDERED, (payload) => scheduleProcessEvent(payload, { allowUser: true }));
  on(eventTypes.GENERATION_ENDED, () => scheduleRecentScan());
  updateStatus(`Krill Image Bridge 监听已启用：${Object.keys(eventTypes).length || 'unknown'} events`);
}

function scheduleProcessEvent(payload, options) {
  if (!settings.autoDetect) return;
  window.setTimeout(() => {
    const ids = resolveMessageIdsFromEvent(payload);
    const targets = ids.length ? ids : recentMessageIds(context.chat, 3);
    targets.forEach((messageId) => processMessage(messageId, options));
  }, 120);
}

function scheduleRecentScan() {
  if (!settings.autoDetect) return;
  window.setTimeout(() => {
    recentMessageIds(context.chat, 4).forEach((messageId) => processMessage(messageId, { allowUser: false }));
  }, 300);
}

async function processMessage(messageId, { allowUser = false } = {}) {
  const message = context.chat?.[messageId];
  if (!message || message.is_system) return;
  if (message.is_user && (!allowUser || !settings.interactiveUserRequests)) return;

  const sourceText = getMessageText(message);
  const requests = extractImageRequests(sourceText, {
    structured: settings.structured,
    naturalLanguage: settings.naturalLanguage,
    sfwTags: settings.sfwTags,
    maxRequests: settings.maxRequests,
  });
  if (requests.length === 0) return;

  for (const request of requests) {
    const key = buildDedupKey(context.chatId, messageId, request.raw);
    if (processed.has(key) || inFlight.has(key) || wasProcessed(message, key)) continue;

    inFlight.add(key);
    try {
      updateStatus(`正在生成图片：${request.prompt.slice(0, 40)}`);
      const result = await requestImage(request, message.is_user ? 'user-message' : 'assistant-message');
      const updatedText = insertGeneratedImageMarkdown(getMessageText(message), {
        raw: request.raw,
        markdown: result.markdown,
        mode: settings.mode,
      });

      message.mes = updatedText;
      if (message.extra?.display_text) message.extra.display_text = updatedText;
      rememberProcessed(message, key, request.prompt);
      context.updateMessageBlock(messageId, message);
      await context.saveChat();
      processed.add(key);
      updateStatus(`图片已插入聊天：message ${messageId}`);
    } catch (error) {
      showError(error);
    } finally {
      inFlight.delete(key);
    }
  }
}

async function requestImage(request, source) {
  return generateDirectImage({
    prompt: request.prompt,
    caption: request.caption || 'Krill image',
    model: settings.defaultModel,
    ratio: request.ratio || settings.defaultRatio,
    resolution: settings.defaultResolution,
    quality: settings.defaultQuality,
    source,
  }, {
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
  });
}

function registerSlashCommand() {
  try {
    context.SlashCommandParser.addCommandObject(context.SlashCommand.fromProps({
      name: 'krill',
      callback: async (_args, prompt) => {
        const text = String(prompt || '').trim();
        if (!text) return 'Usage: /krill image prompt';
        const result = await requestImage({
          prompt: text,
          caption: 'Krill image',
          ratio: settings.defaultRatio,
          raw: text,
        }, 'slash-command');
        return result.markdown;
      },
      helpString: 'Generate an image through the configured Krill/OpenAI-compatible image API. The command returns Markdown image text.',
    }));
    context.SlashCommandParser.addCommandObject(context.SlashCommand.fromProps({
      name: 'krill-scan',
      callback: async () => {
        const ids = recentMessageIds(context.chat, 6);
        ids.forEach((messageId) => processMessage(messageId, { allowUser: true }));
        return `Krill Image Bridge scanned ${ids.length} recent messages.`;
      },
      helpString: 'Scan recent chat messages for Krill image request tags and generate matching images.',
    }));
  } catch (error) {
    console.warn('[Krill Image Bridge] slash command registration skipped:', error);
  }
}

function registerFunctionTool() {
  if (!context.registerFunctionTool) return;
  context.registerFunctionTool({
    name: 'krill_generate_image',
    displayName: 'Krill Generate Image',
    description: 'Generate an image when the user or character explicitly asks to send, draw, render, or create a picture. Use this for roleplay image requests.',
    parameters: {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed visual prompt for the image.',
        },
        caption: {
          type: 'string',
          description: 'Short caption or alt text.',
        },
        ratio: {
          type: 'string',
          enum: ['1:1', '4:3', '3:4', '16:9', '9:16'],
          description: 'Optional image aspect ratio.',
        },
      },
      required: ['prompt'],
    },
    action: async ({ prompt, caption = 'Krill image', ratio = settings.defaultRatio }) => {
      const result = await requestImage({ prompt, caption, ratio, raw: prompt }, 'function-tool');
      return result.markdown;
    },
    formatMessage: ({ prompt }) => `Generating Krill image: ${prompt}`,
    shouldRegister: () => Boolean(settings.functionTool),
    stealth: false,
  });
}

function checkDirectConfig() {
  if (!String(settings.apiKey || '').trim()) {
    updateStatus('请先填写 API Key');
    return;
  }
  updateStatus(`直连配置已就绪：${resolveImageEndpoint(settings.apiBaseUrl)}`);
}

function getMessageText(message) {
  return String(message?.extra?.display_text || message?.mes || '');
}

function wasProcessed(message, key) {
  return Boolean(message.extra?.krillImageBridge?.processedKeys?.includes(key));
}

function rememberProcessed(message, key, prompt) {
  message.extra ||= {};
  message.extra.krillImageBridge ||= { processedKeys: [] };
  message.extra.krillImageBridge.processedKeys ||= [];
  message.extra.krillImageBridge.processedKeys.push(key);
  message.extra.krillImageBridge.lastPrompt = prompt;
  message.extra.krillImageBridge.lastGeneratedAt = new Date().toISOString();
}

function updateStatus(text) {
  jQuery('#krill_bridge_status').text(text);
  console.info('[Krill Image Bridge]', text);
}

function showError(error) {
  let message = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    message = `${message}。如果 iPhone 端报这个错，通常是 API 端 CORS 或网络访问被拦截。`;
  }
  updateStatus(`错误：${message}`);
  window.toastr?.error?.(message, 'Krill Image Bridge');
  console.error('[Krill Image Bridge]', error);
}

function roleCardContract() {
  return `When the scene calls for a generated image, output exactly one image request tag:
<krill_image>
prompt: concise visual prompt in English or Chinese
caption: short caption to show near the image
ratio: 1:1 | 4:3 | 3:4 | 16:9 | 9:16
</krill_image>
Do not invent external image URLs.`;
}
