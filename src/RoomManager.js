import { supabase } from './supabase.js';
import { gameState } from './GameState.js';
import { generateRoomCode, generateUUID } from './utils.js';

export class RoomManager {
    constructor(onStateChange, onGameStart) {
        this.channel = null;
        this.onStateChange = onStateChange;
        this.onGameStart = onGameStart;
    }

    async init() {
        let storedId = localStorage.getItem('playerId');
        if (!storedId) {
            storedId = generateUUID();
            localStorage.setItem('playerId', storedId);
        }
        gameState.playerId = storedId;

        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        if (roomCode) {
            document.getElementById('roomCodeInput').value = roomCode;
        }
    }

    async createRoom(playerName) {
        gameState.playerName = playerName || 'Host';
        gameState.isHost = true;
        const code = generateRoomCode();
        gameState.roomCode = code;

        const { error } = await supabase
            .from('rooms')
            .insert([{ code, host_id: gameState.playerId, status: 'waiting' }]);

        if (error) {
            console.error("Error creating room", error);
            alert("Error creating room.");
            return;
        }

        window.history.pushState({}, '', `?room=${code}`);
        this.joinRealtimeChannel(code);
    }

    async joinRoom(code, playerName) {
        gameState.playerName = playerName || 'Player';
        gameState.isHost = false;
        gameState.roomCode = code.toUpperCase();

        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', gameState.roomCode)
            .single();

        if (error || !data) {
            alert("Room not found.");
            return;
        }

        window.history.pushState({}, '', `?room=${gameState.roomCode}`);
        this.joinRealtimeChannel(gameState.roomCode);
    }

    joinRealtimeChannel(code) {
        this.channel = supabase.channel(`room:${code}`, {
            config: {
                presence: {
                    key: gameState.playerId,
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                const newState = this.channel.presenceState();
                gameState.players = {};
                for (const id in newState) {
                    gameState.players[id] = newState[id][0];
                }
                this.onStateChange();
            })
            .on('broadcast', { event: 'game_start' }, (payload) => {
                gameState.status = 'playing';
                gameState.players = payload.payload.players;
                this.onGameStart();
            })
            .on('broadcast', { event: 'sync_bugs' }, (payload) => {
                if (!gameState.isHost) {
                    gameState.bugs = payload.payload.bugs;
                    gameState.score = payload.payload.score;
                }
            })
            .on('broadcast', { event: 'teleport' }, (payload) => {
                if (payload.payload.id === gameState.playerId && window.playerController) {
                    window.playerController.localPos.x = payload.payload.x;
                    window.playerController.localPos.y = payload.payload.y;
                    window.playerController.pausedUntil = Date.now() + 5000;
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.channel.track({
                        id: gameState.playerId,
                        name: gameState.playerName,
                        role: 'spectator',
                        x: 0,
                        y: 0,
                        health: 100,
                        state: 'active'
                    });
                }
            });
    }

    startGame() {
        if (!gameState.isHost) return;

        // Assign roles randomly
        const playerIds = Object.keys(gameState.players);
        const shuffled = playerIds.sort(() => 0.5 - Math.random());
        const half = Math.ceil(shuffled.length / 2);

        shuffled.forEach((id, index) => {
            if (index < half) {
                gameState.players[id].role = 'lumberjack';
            } else {
                gameState.players[id].role = 'wolf';
            }
        });

        gameState.status = 'playing';

        // Broadcast game start
        this.channel.send({
            type: 'broadcast',
            event: 'game_start',
            payload: { players: gameState.players }
        });

        // Update room status
        supabase.from('rooms')
            .update({ status: 'playing' })
            .eq('code', gameState.roomCode)
            .then(() => {});

        this.onGameStart();
    }
}
