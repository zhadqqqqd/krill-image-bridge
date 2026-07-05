# Krill Image Bridge

TauriTavern/SillyTavern extension for role-card driven Krill image generation.

## What it does

- Watches completed assistant messages.
- Detects explicit image-generation intent from role-card output.
- Calls a Krill/OpenAI-compatible image API directly from the extension.
- Inserts generated images back into chat as Markdown data-image links.

No local agent or Mac LAN server is required.

## Supported triggers

Preferred structured tag:

```text
<krill_image>
prompt: ancient underground river, huge stone gate, xianxia, cinematic lighting
caption: 万妖之门
ratio: 16:9
</krill_image>
```

Also supported:

```text
<image_prompt>地下暗河，青铜巨门，仙侠暗黑氛围</image_prompt>
[GENERATE_IMAGE: xianxia tavern under moonlight]
{{image: xianxia tavern under moonlight}}
```

Natural-language detection is also enabled by default for explicit requests such as "画一张万妖之门的场景图" or "send me a picture of a cat".

`<SFW_IMG>` and `<NSFW_IMG>` are ignored by default. Enable the compatibility toggle only for role cards that use those tags as generation requests rather than local asset references.

## Install extension

```bash
git clone https://github.com/zhadqqqqd/krill-image-bridge.git
cd krill-image-bridge
npm run install-extension
```

Restart TauriTavern after installing. Open the Extensions panel and find "Krill Image Bridge".

## Configure

Open the extension settings and fill:

- `API Base URL`: defaults to `https://api.krill-ai.com/codex/v1`
- `API Key`: your Krill/Codex-compatible API key
- `Krill image model`: defaults to `gpt-image-2`
- `Quality`: defaults to `high`

The extension sends requests to:

```text
{API Base URL}/images/generations
```

## iPhone use

Install the extension in TauriTavern on iPhone, then enter the API Base URL and API Key in the extension settings. Because there is no agent, the iPhone must be able to reach the image API directly.

If generation fails with a network/CORS error, that means the API endpoint does not allow browser/WebView direct requests. In that case a proxy or agent is technically required by browser security rules.

## Manual command

After configuration, `/krill your image prompt` generates one image and returns Markdown.
