import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageRequests } from './trigger-parser.js';

test('extracts structured krill_image block', () => {
  const text = '<krill_image>prompt: ancient gate\ncaption: 万妖之门\nratio: 16:9</krill_image>';

  assert.deepEqual(extractImageRequests(text, { structured: true }), [{
    kind: 'structured',
    prompt: 'ancient gate',
    caption: '万妖之门',
    ratio: '16:9',
    raw: text,
  }]);
});

test('extracts image_prompt block with raw body as prompt', () => {
  const text = '<image_prompt>地下暗河，青铜巨门，仙侠暗黑氛围</image_prompt>';

  assert.deepEqual(extractImageRequests(text, { structured: true }), [{
    kind: 'structured',
    prompt: '地下暗河，青铜巨门，仙侠暗黑氛围',
    caption: 'Krill image',
    ratio: '',
    raw: text,
  }]);
});

test('extracts bracket structured prompt', () => {
  const text = '[GENERATE_IMAGE: xianxia tavern under moonlight]';

  assert.equal(extractImageRequests(text, { structured: true })[0].prompt, 'xianxia tavern under moonlight');
});

test('extracts Chinese natural-language image intent', () => {
  const text = '她轻声说：我给你画一张万妖之门的场景图。';
  const [request] = extractImageRequests(text, { naturalLanguage: true });

  assert.equal(request.kind, 'natural-language');
  assert.equal(request.prompt, '万妖之门的场景图');
});

test('extracts English natural-language image intent', () => {
  const text = 'Can you please send me a picture of a cat wearing armor?';
  const [request] = extractImageRequests(text, { naturalLanguage: true });

  assert.equal(request.kind, 'natural-language');
  assert.equal(request.prompt, 'a cat wearing armor');
});

test('ignores SFW_IMG tags unless compatibility mode is enabled', () => {
  const text = '<SFW_IMG>宗主虞清寒/虞清寒微笑的表情/3.jpg</SFW_IMG>';

  assert.deepEqual(extractImageRequests(text, { sfwTags: false }), []);
  assert.equal(extractImageRequests(text, { sfwTags: true })[0].kind, 'asset-tag');
});

test('limits extracted requests', () => {
  const text = '<krill_image>prompt: one</krill_image><krill_image>prompt: two</krill_image>';

  assert.equal(extractImageRequests(text, { maxRequests: 1 }).length, 1);
});
