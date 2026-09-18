// chat/store.js
export const requestLog = [];
const MAX_LOG = 100;

export function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function logRequest(item) {
  requestLog.unshift(item);
  if (requestLog.length > MAX_LOG) requestLog.length = MAX_LOG;
}

export function getRequestLog() {
  return [...requestLog];
}

export function getRequest(requestId) {
  return requestLog.find(r => r.requestId === requestId) || null;
}

export function updateRequest(requestId, patch) {
  const r = requestLog.find(r => r.requestId === requestId);
  if (r) Object.assign(r, patch);
  return r;
}
