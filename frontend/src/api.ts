export type Credentials = { code: string; role: 'host' | 'guest'; key: string; expiresAt: number };
export type RoomState = {
  type: 'state'; code: string; role: 'host' | 'guest'; status: 'waiting' | 'playing' | 'solved' | 'locked' | 'complete' | 'expired';
  puzzle: number; puzzleName: string; roleNote: string; entries: string[]; attempts: number;
  step: number; totalSteps: number; lastSignal: string | null; hostConnected: boolean;
  guestConnected: boolean; expiresAt: number; unlocked: boolean;
};

async function jsonRequest<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch { throw new Error('The game server is out of reach. Check your connection and try again.'); }
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result as T;
}

export const createRoom = (expiryMinutes: number, unlocked: boolean) => jsonRequest<Credentials>('/api/sessions', { expiryMinutes, unlocked });
export const joinRoom = (code: string, key?: string) => jsonRequest<Credentials>(`/api/sessions/${encodeURIComponent(code)}/join`, { key });

export function connectRoom(credentials: Credentials, onState: (state: RoomState) => void, onNetwork: (status: string) => void): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/api/sessions/${credentials.code}/ws?role=${credentials.role}&key=${encodeURIComponent(credentials.key)}`);
  socket.addEventListener('open', () => onNetwork('Waiting'));
  socket.addEventListener('message', (event) => { const state = JSON.parse(event.data); if (state.type === 'state') onState(state); });
  socket.addEventListener('close', () => onNetwork(navigator.onLine ? 'Connection lost' : 'Offline'));
  socket.addEventListener('error', () => onNetwork('Connection lost'));
  return socket;
}
