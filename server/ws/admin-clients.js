// ws/admin-clients.js
export const adminClients = new Set();

export function broadcastAdmins(data) {
  const msg = JSON.stringify(data);
  for (const ws of adminClients) {
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch {}
    }
  }
}
