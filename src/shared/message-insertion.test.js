import test from 'node:test';
import assert from 'node:assert/strict';
import { insertGeneratedImageMarkdown } from './message-insertion.js';

test('replaces structured marker with markdown in replace mode', () => {
  const original = '看这里：<krill_image>prompt: gate</krill_image>';
  const result = insertGeneratedImageMarkdown(original, {
    raw: '<krill_image>prompt: gate</krill_image>',
    markdown: '![gate](http://127.0.0.1/image.png)',
    mode: 'replace',
  });

  assert.equal(result, '看这里：![gate](http://127.0.0.1/image.png)');
});

test('appends markdown when marker is not present', () => {
  const result = insertGeneratedImageMarkdown('她说要画一张图。', {
    raw: 'not present',
    markdown: '![image](http://127.0.0.1/image.png)',
    mode: 'replace',
  });

  assert.equal(result, '她说要画一张图。\n\n![image](http://127.0.0.1/image.png)');
});

test('append mode always appends', () => {
  const result = insertGeneratedImageMarkdown('hello', {
    raw: 'hello',
    markdown: '![image](http://127.0.0.1/image.png)',
    mode: 'append',
  });

  assert.equal(result, 'hello\n\n![image](http://127.0.0.1/image.png)');
});
