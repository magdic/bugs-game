import { createClient } from '@supabase/supabase-js';

export default class Network {
    constructor() {
        const supabaseUrl = 'https://ghlxgnablomhqaxomyqx.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobHhnbmFibG9taHFheG9teXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzYxMDYsImV4cCI6MjA5NTUxMjEwNn0.LHJ5tha0RNBjeGiFWFgS91hvHb0qjGz4CxEyg6gEPPY';

        this.supabase = createClient(supabaseUrl, supabaseKey);

        this.roomName = null;
        this.channel = null;

        this.callbacks = {
            onPresenceSync: null,
            onGameStateUpdate: null,
            onPlayerAction: null,
        };

        this.localPlayerMetadata = null;
    }

    joinRoom(roomCode, playerData) {
        this.roomName = `soccer_room_${roomCode}`;
        this.localPlayerMetadata = playerData;

        this.channel = this.supabase.channel(this.roomName, {
            config: {
                presence: {
                    key: 'player',
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                const newState = this.channel.presenceState();
                if (this.callbacks.onPresenceSync) {
                    this.callbacks.onPresenceSync(newState);
                }
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('join', key, newPresences)
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                 console.log('leave', key, leftPresences)
            })
            .on('broadcast', { event: 'gameState' }, ({ payload }) => {
                if (this.callbacks.onGameStateUpdate) {
                    this.callbacks.onGameStateUpdate(payload);
                }
            })
            .on('broadcast', { event: 'playerAction' }, ({ payload }) => {
                if (this.callbacks.onPlayerAction) {
                    this.callbacks.onPlayerAction(payload);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const presenceTrackStatus = await this.channel.track(this.localPlayerMetadata);
                    console.log('Presence track status:', presenceTrackStatus);
                }
            });
    }

    leaveRoom() {
        if (this.channel) {
            this.channel.untrack();
            this.supabase.removeChannel(this.channel);
        }
    }

    broadcastGameState(state) {
        if (!this.channel) return;
        this.channel.send({
            type: 'broadcast',
            event: 'gameState',
            payload: state
        });
    }

    broadcastAction(action) {
         if (!this.channel) return;
         this.channel.send({
            type: 'broadcast',
            event: 'playerAction',
            payload: action
        });
    }

    broadcastPlayerTransform(transform) {
         if (!this.channel) return;
         this.channel.send({
            type: 'broadcast',
            event: 'playerTransform',
            payload: transform
        });
    }
}
