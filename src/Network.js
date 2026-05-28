import { createClient } from '@supabase/supabase-js';

export default class Network {
    constructor() {
        // Initialize Supabase Client
        const supabaseUrl = 'https://ghlxgnablomhqaxomyqx.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobHhnbmFibG9taHFheG9teXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzYxMDYsImV4cCI6MjA5NTUxMjEwNn0.LHJ5tha0RNBjeGiFWFgS91hvHb0qjGz4CxEyg6gEPPY'; // Using the anon key obtained earlier

        this.supabase = createClient(supabaseUrl, supabaseKey);

        // Single room for this simple setup
        this.roomName = 'soccer_room_1';
        this.channel = this.supabase.channel(this.roomName, {
            config: {
                presence: {
                    key: 'player', // Optional, defaults to user ID if auth'd, but we are using anon
                },
            },
        });

        this.callbacks = {
            onPresenceSync: null,
            onGameStateUpdate: null,
            onPlayerAction: null, // e.g. for shooting/passing events
        };

        this.localPlayerMetadata = null;
    }

    joinRoom(playerData) {
        this.localPlayerMetadata = playerData;

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
                    // Track our presence once subscribed
                    const presenceTrackStatus = await this.channel.track(this.localPlayerMetadata);
                    console.log('Presence track status:', presenceTrackStatus);
                }
            });
    }

    leaveRoom() {
        this.channel.untrack();
        this.supabase.removeChannel(this.channel);
    }

    // Host updates the overall game state (ball position, score, time)
    broadcastGameState(state) {
        this.channel.send({
            type: 'broadcast',
            event: 'gameState',
            payload: state
        });
    }

    // Any player broadcasts an action (shoot, pass)
    broadcastAction(action) {
         this.channel.send({
            type: 'broadcast',
            event: 'playerAction',
            payload: action
        });
    }

    // Broadcast player transform (position, rotation)
    // Often you want a dedicated high-frequency channel or event for this
    broadcastPlayerTransform(transform) {
         this.channel.send({
            type: 'broadcast',
            event: 'playerTransform', // Separate event
            payload: transform
        });
    }
}
