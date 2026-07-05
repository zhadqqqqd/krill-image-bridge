const DEFAULT_EVENT_TYPES = {
  MESSAGE_RECEIVED: 'message_received',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  MESSAGE_SENT: 'message_sent',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
  GENERATION_ENDED: 'generation_ended',
};

export function getEventTypes(context = {}) {
  return {
    ...DEFAULT_EVENT_TYPES,
    ...(context.event_types || context.eventTypes || {}),
  };
}

export function resolveMessageIdsFromEvent(payload) {
  if (Number.isInteger(payload)) return [payload];
  if (typeof payload === 'string' && /^\d+$/.test(payload)) return [Number(payload)];
  if (!payload || typeof payload !== 'object') return [];

  const value = payload.messageId ?? payload.message_id ?? payload.id ?? payload.index;
  if (Number.isInteger(value)) return [value];
  if (typeof value === 'string' && /^\d+$/.test(value)) return [Number(value)];
  return [];
}

export function recentMessageIds(chat = [], limit = 3) {
  const ids = [];
  for (let index = chat.length - 1; index >= 0 && ids.length < limit; index -= 1) {
    ids.push(index);
  }
  return ids;
}
