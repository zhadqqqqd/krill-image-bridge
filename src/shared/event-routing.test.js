import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventTypes,
  resolveMessageIdsFromEvent,
  recentMessageIds,
} from './event-routing.js';

test('getEventTypes supports SillyTavern event_types and legacy eventTypes', () => {
  assert.deepEqual(getEventTypes({ event_types: { MESSAGE_RECEIVED: 'message_received' } }), {
    MESSAGE_RECEIVED: 'message_received',
  });
  assert.deepEqual(getEventTypes({ eventTypes: { MESSAGE_RECEIVED: 'legacy' } }), {
    MESSAGE_RECEIVED: 'legacy',
  });
});

test('resolveMessageIdsFromEvent accepts numeric and object payloads', () => {
  assert.deepEqual(resolveMessageIdsFromEvent(3), [3]);
  assert.deepEqual(resolveMessageIdsFromEvent({ messageId: 4 }), [4]);
  assert.deepEqual(resolveMessageIdsFromEvent({ message_id: 5 }), [5]);
  assert.deepEqual(resolveMessageIdsFromEvent({ id: 6 }), [6]);
});

test('recentMessageIds returns newest message indexes first', () => {
  const chat = [{}, {}, {}, {}];

  assert.deepEqual(recentMessageIds(chat, 3), [3, 2, 1]);
});
