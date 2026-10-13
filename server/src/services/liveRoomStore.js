const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

class LiveRoomStore {
  constructor() { this.memory = new Map(); this.client = null; this.ready = false; }

  async attachSocketAdapter(io) {
    if (!process.env.REDIS_URL) { console.warn('[Live Rooms] REDIS_URL is not set; using local state.'); return; }
    try {
      this.client = createClient({ url: process.env.REDIS_URL });
      this.client.on('error', (error) => console.error('[Redis] error:', error.message));
      await this.client.connect();
      const subscriber = this.client.duplicate();
      subscriber.on('error', (error) => console.error('[Redis] subscriber error:', error.message));
      await subscriber.connect();
      io.adapter(createAdapter(this.client, subscriber));
      this.ready = true;
      console.log('[Live Rooms] Redis adapter connected.');
    } catch (error) { console.error('[Live Rooms] Redis unavailable:', error.message); }
  }

  serialise(room) { return { ...room, timerInterval: undefined, participants: Array.from(room.participants?.entries?.() || []) }; }
  hydrate(data) { return data ? { ...data, startedAt: data.startedAt ? new Date(data.startedAt) : null, participants: new Map(data.participants || []), timerInterval: null } : null; }

  async get(code) {
    if (!this.ready) return this.memory.get(code) || null;
    try { const raw = await this.client.get(`quizese:live-room:${code}`); const room = raw ? this.hydrate(JSON.parse(raw)) : null; if (room) this.memory.set(code, room); return room || this.memory.get(code) || null; }
    catch (error) { console.error('[Live Rooms] read failed:', error.message); return null; }
  }
  async set(code, room) {
    this.memory.set(code, room);
    if (!this.ready) return;
    try { await this.client.set(`quizese:live-room:${code}`, JSON.stringify(this.serialise(room)), { EX: 43200 }); }
    catch (error) { console.error('[Live Rooms] save failed:', error.message); }
  }
}

module.exports = new LiveRoomStore();
