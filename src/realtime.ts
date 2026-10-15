export type RealtimeEvent = {
  type:
    | 'room:connected'
    | 'room:joined'
    | 'room:left'
    | 'room:participant-status'
    | 'character:hp-updated'
    | 'campaign:snapshot-created'
    | 'turn:updated'
    | 'room:refreshed'
    | 'error';
  roomId?: string;
  campaignId?: string;
  userId?: string;
  characterId?: string;
  payload?: unknown;
  at: string;
};

export function getRoomSocketUrl(roomId: string, userId: string, backendPort = 3000) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const currentHost = window.location.hostname || '127.0.0.1';
  const host = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1' ? '127.0.0.1' : currentHost;
  const params = new URLSearchParams({ userId });

  return `${protocol}//${host}:${backendPort}/ws/rooms/${roomId}?${params.toString()}`;
}
