# Krill Image Bridge

TauriTavern/SillyTavern extension plus local agent for role-card driven Krill image generation.

## What it does

- Watches completed assistant messages.
- Detects explicit image-generation intent from role-card output.
- Calls a local Krill Agent instead of putting API keys in the browser extension.
- Inserts generated images back into chat as Markdown image links.

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
git clone <this-repo-url>
cd krill-image-bridge
npm run install-extension
```

Restart TauriTavern after installing. Open the Extensions panel and find "Krill Image Bridge".

## Start local agent on Mac

```bash
npm start
```

By default the agent uses the Codex API key and base URL from `~/.codex`. Override them only when needed:

```bash
KRILL_API_KEY='your-key' \
KRILL_API_BASE='https://api.cdn-krill-ai.com/codex/v1' \
npm start
```

Useful environment variables:

- `KRILL_API_KEY`: Krill API key. If omitted, the agent tries Codex `~/.codex/auth.json` first, then TauriTavern's active custom API key from `secrets.json`.
- `KRILL_API_BASE`: Base URL. If omitted, the agent tries Codex `~/.codex/config.toml` first, then falls back to `https://api.cdn-krill-ai.com/codex/v1`.
- `KRILL_IMAGE_ENDPOINT`: Full image endpoint override. If set, it overrides `KRILL_API_BASE`.
- `KRILL_IMAGE_MODEL`: Default image model. Defaults to `gpt-image-2`.
- `KRILL_IMAGE_QUALITY`: Default image quality. Defaults to `high`.
- `KRILL_AGENT_HOST`: Defaults to `127.0.0.1`. Use `0.0.0.0` for iPhone/LAN access.
- `KRILL_AGENT_PORT`: Defaults to `8788`.
- `KRILL_PUBLIC_BASE_URL`: Public URL returned in Markdown. For iPhone use a Mac LAN URL, for example `http://192.168.1.20:8788`.
- `KRILL_IMAGE_DIR`: Image output folder. Defaults to `krill-image-bridge/data/images`.

## iPhone quick start

If TauriTavern runs on iPhone and the agent runs on Mac, do not use `127.0.0.1` in generated image URLs. Keep the iPhone and Mac on the same Wi-Fi, then start the agent with LAN mode:

```bash
npm run start:lan
```

The command prints an iPhone Agent URL, for example:

```text
iPhone Agent URL: http://192.168.1.20:8788
```

Set the extension Agent URL on iPhone to that printed URL and press "Check Agent". If macOS asks about incoming network connections, allow Node.js for the local network.

## GitHub install on iPhone

This repository is meant to be the source package. For iPhone use, the agent still runs on your Mac because it needs your API key and writes generated images to disk. The iPhone extension only calls the Mac LAN Agent URL and receives Markdown image links.
