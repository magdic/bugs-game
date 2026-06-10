import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabaseUrl = 'https://hagseiwqouapirtlbume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ3NlaXdxb3VhcGlydGxidW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNjIzMzYsImV4cCI6MjA5NTYzODMzNn0.9dy-1MyzPtLU86MLLwRGqYO5BwzDywsLgYg0QKRZ2o0';
export const supabase = createClient(supabaseUrl, supabaseKey);

export class SupabaseManager {
  constructor() {
    this.roomId = null;
    this.playerId = null;
    this.roomSubscription = null;
    this.playersSubscription = null;
    this.presenceSubscription = null;
    this.onRoomUpdate = null;
    this.onPlayersUpdate = null;
  }

  async createRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ code, status: 'lobby' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getRoomByCode(code) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();
    if (error) throw error;
    return data;
  }

  async joinRoom(roomId, playerInfo) {
    const { data, error } = await supabase
      .from('players')
      .insert([{ room_id: roomId, ...playerInfo }])
      .select()
      .single();
    if (error) throw error;
    this.roomId = roomId;
    this.playerId = data.id;
    return data;
  }

  async getPlayers(roomId) {
     const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async updateRoomStatus(roomId, status, round = null) {
    const updates = { status };
    if (round !== null) updates.round = round;

    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId);
    if (error) throw error;
  }

  async updatePlayerInfo(playerId, updates) {
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId);
    if (error) throw error;
  }

  async removePlayer() {
    if (!this.playerId) return;
    const { error } = await supabase.from('players').delete().eq('id', this.playerId);
    if (error) console.error("Failed to remove player on exit:", error);
  }

  async removePlayerById(id) {
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) console.error("Failed to remove player by ID:", error);
  }

  async uploadScreenshot(playerId, dataUrl) {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const fileName = `${playerId}-${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('screenshots')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);

    return publicData.publicUrl;
  }

  subscribeToRoom(roomId, onUpdate) {
    if (this.roomSubscription) supabase.removeChannel(this.roomSubscription);
    this.onRoomUpdate = onUpdate;
    this.roomSubscription = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        if (this.onRoomUpdate) this.onRoomUpdate(payload.new);
      })
      .subscribe();
  }

  subscribeToPlayers(roomId, onUpdate) {
    if (this.playersSubscription) supabase.removeChannel(this.playersSubscription);
    this.onPlayersUpdate = onUpdate;
    this.playersSubscription = supabase
      .channel(`players:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, payload => {
        if (this.onPlayersUpdate) this.onPlayersUpdate(payload);
      })
      .subscribe();
  }

  subscribeToPresence(roomId, playerId, onPresenceUpdate) {
    if (this.presenceSubscription) supabase.removeChannel(this.presenceSubscription);
    
    this.presenceSubscription = supabase.channel(`presence:${roomId}`);
    this.presenceSubscription
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceSubscription.presenceState();
        const activeIds = [];
        for (const key in state) {
          state[key].forEach(p => { if (p.player_id) activeIds.push(p.player_id); });
        }
        if (onPresenceUpdate) onPresenceUpdate(activeIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.presenceSubscription.track({ player_id: playerId });
        }
      });
  }
}
