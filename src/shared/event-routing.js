export function getEventTypes(context = {}) {
  return context.event_types || context.eventTypes || {};
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
